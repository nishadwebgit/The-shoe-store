using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Options;
using ShoeStore.Domain.Entities;

namespace ShoeStore.Application.Services;

public interface ICartService
{
    Task<CartDto> GetAsync(CartOwner owner, string? deliveryMethod, CancellationToken ct);
    Task<CartDto> AddItemAsync(CartOwner owner, AddCartItemRequest request, CancellationToken ct);
    Task<CartDto> UpdateQuantityAsync(CartOwner owner, string sku, int quantity, CancellationToken ct);
    Task<CartDto> RemoveItemAsync(CartOwner owner, string sku, CancellationToken ct);
    Task<CartDto> ClearAsync(CartOwner owner, CancellationToken ct);
    Task<CartDto> ApplyCouponAsync(CartOwner owner, string code, CancellationToken ct);
    Task<CartDto> RemoveCouponAsync(CartOwner owner, CancellationToken ct);
    Task<CartDto> MergeAnonymousCartAsync(Guid customerId, Guid anonymousToken, CancellationToken ct);

    /// <summary>Loads the owner's cart with everything needed for pricing and checkout (tracked).</summary>
    Task<Cart?> LoadCartAsync(CartOwner owner, bool tracked, CancellationToken ct);

    Task<PricingResult> PriceAsync(Cart? cart, ShippingMethod method, string? couponCodeOverride, CancellationToken ct);
}

/// <summary>Server-side shopping cart for customers and anonymous visitors.</summary>
public sealed class CartService(
    IAppDbContext db,
    IClock clock,
    IOptions<PricingOptions> pricingOptions,
    ILogger<CartService> logger) : ICartService
{
    private readonly PricingOptions _pricing = pricingOptions.Value;

    public async Task<Cart?> LoadCartAsync(CartOwner owner, bool tracked, CancellationToken ct)
    {
        if (!owner.HasOwner) return null;
        IQueryable<Cart> query = db.Carts
            .AsSplitQuery()
            .Include(c => c.Items).ThenInclude(i => i.ProductVariant).ThenInclude(v => v.Product).ThenInclude(p => p.Brand)
            .Include(c => c.Items).ThenInclude(i => i.ProductVariant).ThenInclude(v => v.Colour).ThenInclude(c => c.Images)
            .Include(c => c.Items).ThenInclude(i => i.ProductVariant).ThenInclude(v => v.Size);
        if (!tracked) query = query.AsNoTracking();

        if (owner.CustomerId is { } customerId)
            return await query.FirstOrDefaultAsync(c => c.CustomerId == customerId, ct);
        var token = owner.AnonymousToken!.Value;
        return await query.FirstOrDefaultAsync(c => c.AnonymousId == token && c.CustomerId == null, ct);
    }

    private async Task<Cart> GetOrCreateCartAsync(CartOwner owner, CancellationToken ct)
    {
        var cart = await LoadCartAsync(owner, tracked: true, ct);
        if (cart is not null) return cart;

        cart = new Cart
        {
            Id = Guid.NewGuid(),
            CustomerId = owner.CustomerId,
            AnonymousId = owner.CustomerId.HasValue ? null : owner.AnonymousToken ?? Guid.NewGuid(),
        };
        db.Carts.Add(cart);
        return cart;
    }

    private int MaxFor(ProductVariant variant) => Math.Max(0, Math.Min(variant.StockQuantity, _pricing.MaxQuantityPerLine));

    private async Task<ShippingMethod> ShippingMethodAsync(string? code, CancellationToken ct)
    {
        var key = string.IsNullOrWhiteSpace(code) ? "standard" : code.Trim().ToLowerInvariant();
        return await db.ShippingMethods.AsNoTracking().FirstOrDefaultAsync(m => m.Code == key && m.IsActive, ct)
               ?? throw new BusinessRuleException($"\"{key}\" isn't a delivery option. Choose standard, express or pickup.", "invalid_delivery_method");
    }

    public async Task<PricingResult> PriceAsync(Cart? cart, ShippingMethod method, string? couponCodeOverride, CancellationToken ct)
    {
        var lines = (cart?.Items ?? [])
            .Select(i => new PricingLine(i.ProductVariant.Product.Price, i.ProductVariant.Product.OriginalPrice, i.Quantity))
            .ToList();
        var subtotal = lines.Sum(l => l.UnitPrice * l.Quantity);

        var code = couponCodeOverride ?? cart?.CouponCode;
        Coupon? coupon = null;
        string? couponError = null;
        if (!string.IsNullOrWhiteSpace(code) && lines.Count > 0)
        {
            var normalised = code.Trim().ToUpperInvariant();
            coupon = await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Code == normalised, ct);
            couponError = PricingCalculator.ValidateCoupon(coupon, normalised, subtotal, clock.UtcNow);
        }

        return PricingCalculator.Calculate(lines, coupon, couponError, method, _pricing.FreeShippingThreshold);
    }

    private async Task<CartDto> ToDtoAsync(Cart? cart, string? deliveryMethod, CancellationToken ct)
    {
        var method = await ShippingMethodAsync(deliveryMethod, ct);
        var pricing = await PriceAsync(cart, method, null, ct);

        var lines = (cart?.Items ?? [])
            .OrderBy(i => i.CreatedUtc).ThenBy(i => i.Id)
            .Select(i =>
            {
                var v = i.ProductVariant;
                var image = v.Colour.Images.OrderBy(img => img.SortOrder).Select(img => img.Url).FirstOrDefault() ?? string.Empty;
                return new CartLineDto(
                    v.Sku, v.Sku, v.Product.Code, v.Product.Slug, v.Product.Name, v.Product.Brand.Name,
                    v.Colour.Code, v.Colour.Name, v.Size.Code, image,
                    v.Product.Price, v.Product.IsOnSale ? v.Product.OriginalPrice : null,
                    i.Quantity, MaxFor(v));
            })
            .ToList();

        var totals = new CartTotalsDto(
            pricing.ItemCount,
            pricing.Subtotal,
            pricing.SaleSavings,
            pricing.Discount,
            pricing.AppliedCoupon?.Code,
            pricing.AppliedCoupon?.Description,
            pricing.CouponError,
            pricing.Shipping,
            method.Code,
            pricing.Total,
            pricing.AmountToFreeShipping,
            _pricing.Currency);

        return new CartDto(
            cart?.CustomerId is null ? cart?.AnonymousId : null,
            lines,
            cart?.CouponCode,
            cart?.ModifiedUtc ?? cart?.CreatedUtc ?? clock.UtcNow,
            totals);
    }

    /// <summary>Clamps quantities to current stock and drops lines that sold out.</summary>
    private bool ReconcileStock(Cart cart)
    {
        var changed = false;
        foreach (var item in cart.Items.ToList())
        {
            var max = MaxFor(item.ProductVariant);
            if (max == 0 || !item.ProductVariant.Product.IsActive)
            {
                cart.Items.Remove(item);
                db.CartItems.Remove(item);
                changed = true;
            }
            else if (item.Quantity > max)
            {
                item.Quantity = max;
                changed = true;
            }
        }
        return changed;
    }

    public async Task<CartDto> GetAsync(CartOwner owner, string? deliveryMethod, CancellationToken ct)
    {
        var cart = await LoadCartAsync(owner, tracked: true, ct);
        if (cart is not null && ReconcileStock(cart))
        {
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Cart {CartId} adjusted to current stock levels", cart.Id);
        }
        return await ToDtoAsync(cart, deliveryMethod, ct);
    }

    public async Task<CartDto> AddItemAsync(CartOwner owner, AddCartItemRequest request, CancellationToken ct)
    {
        var productCode = request.ProductId.Trim().ToUpperInvariant();
        var colourCode = request.ColourId.Trim().ToLowerInvariant();
        var sizeCode = request.Size.Trim().ToUpperInvariant();

        var variant = await db.ProductVariants
            .Include(v => v.Product)
            .Include(v => v.Size)
            .FirstOrDefaultAsync(v => v.Product.Code == productCode && v.Product.IsActive
                                      && v.Colour.Code == colourCode && v.Size.Code == sizeCode, ct)
            ?? throw new BusinessRuleException("Select a colour and size before adding to your bag.", "variant_not_found");

        if (variant.StockQuantity <= 0)
            throw new ConflictException($"UK {variant.Size.Label} is sold out in this colour.", "out_of_stock");

        var cart = await GetOrCreateCartAsync(owner, ct);
        var existing = cart.Items.FirstOrDefault(i => i.ProductVariantId == variant.Id);
        var max = MaxFor(variant);
        var already = existing?.Quantity ?? 0;
        var desired = already + request.Quantity;
        if (desired > max)
        {
            var left = max - already;
            throw new ConflictException(
                left > 0
                    ? $"Only {left} more available in this size. You already have {already} in your bag."
                    : $"You already have the maximum available ({max}) in your bag.",
                "insufficient_stock");
        }

        if (existing is null)
        {
            var item = new CartItem { CartId = cart.Id, ProductVariantId = variant.Id, Quantity = request.Quantity };
            cart.Items.Add(item);
        }
        else
        {
            existing.Quantity = desired;
        }

        cart.ModifiedUtc = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Added {Quantity} x {Sku} to cart {CartId}", request.Quantity, variant.Sku, cart.Id);

        return await GetAsync(owner.CustomerId.HasValue ? owner : new CartOwner(null, cart.AnonymousId), null, ct);
    }

    private async Task<Cart> RequireCartAsync(CartOwner owner, CancellationToken ct) =>
        await LoadCartAsync(owner, tracked: true, ct)
        ?? throw new NotFoundException("Your bag is empty.", "cart_not_found");

    public async Task<CartDto> UpdateQuantityAsync(CartOwner owner, string sku, int quantity, CancellationToken ct)
    {
        var cart = await RequireCartAsync(owner, ct);
        var item = cart.Items.FirstOrDefault(i => string.Equals(i.ProductVariant.Sku, sku, StringComparison.OrdinalIgnoreCase))
                   ?? throw new NotFoundException("That item is no longer in your bag.", "line_not_found");
        var max = MaxFor(item.ProductVariant);
        if (quantity > max)
            throw new ConflictException($"Only {max} available in this size.", "insufficient_stock");

        item.Quantity = quantity;
        cart.ModifiedUtc = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return await GetAsync(owner, null, ct);
    }

    public async Task<CartDto> RemoveItemAsync(CartOwner owner, string sku, CancellationToken ct)
    {
        var cart = await RequireCartAsync(owner, ct);
        var item = cart.Items.FirstOrDefault(i => string.Equals(i.ProductVariant.Sku, sku, StringComparison.OrdinalIgnoreCase));
        if (item is not null)
        {
            cart.Items.Remove(item);
            db.CartItems.Remove(item);
            cart.ModifiedUtc = clock.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        return await GetAsync(owner, null, ct);
    }

    public async Task<CartDto> ClearAsync(CartOwner owner, CancellationToken ct)
    {
        var cart = await LoadCartAsync(owner, tracked: true, ct);
        if (cart is not null)
        {
            db.CartItems.RemoveRange(cart.Items);
            cart.Items.Clear();
            cart.CouponCode = null;
            cart.ModifiedUtc = clock.UtcNow;
            await db.SaveChangesAsync(ct);
        }
        return await GetAsync(owner, null, ct);
    }

    public async Task<CartDto> ApplyCouponAsync(CartOwner owner, string code, CancellationToken ct)
    {
        var cart = await RequireCartAsync(owner, ct);
        if (cart.Items.Count == 0)
            throw new BusinessRuleException("Add something to your bag before applying a code.", "cart_empty");

        var normalised = code.Trim().ToUpperInvariant();
        var coupon = await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Code == normalised, ct);
        var subtotal = cart.Items.Sum(i => i.ProductVariant.Product.Price * i.Quantity);
        var error = PricingCalculator.ValidateCoupon(coupon, normalised, subtotal, clock.UtcNow);
        if (error is not null) throw new BusinessRuleException(error, "invalid_coupon");

        cart.CouponCode = coupon!.Code;
        cart.ModifiedUtc = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return await GetAsync(owner, null, ct);
    }

    public async Task<CartDto> RemoveCouponAsync(CartOwner owner, CancellationToken ct)
    {
        var cart = await RequireCartAsync(owner, ct);
        cart.CouponCode = null;
        cart.ModifiedUtc = clock.UtcNow;
        await db.SaveChangesAsync(ct);
        return await GetAsync(owner, null, ct);
    }

    public async Task<CartDto> MergeAnonymousCartAsync(Guid customerId, Guid anonymousToken, CancellationToken ct)
    {
        var customerOwner = new CartOwner(customerId, null);
        var anonymous = await LoadCartAsync(new CartOwner(null, anonymousToken), tracked: true, ct);
        if (anonymous is null || anonymous.Items.Count == 0)
        {
            if (anonymous is not null) db.Carts.Remove(anonymous);
            await db.SaveChangesAsync(ct);
            return await GetAsync(customerOwner, null, ct);
        }

        var target = await GetOrCreateCartAsync(customerOwner, ct);
        foreach (var item in anonymous.Items.ToList())
        {
            var max = MaxFor(item.ProductVariant);
            if (max == 0) continue;
            var existing = target.Items.FirstOrDefault(i => i.ProductVariantId == item.ProductVariantId);
            if (existing is null)
                target.Items.Add(new CartItem { CartId = target.Id, ProductVariantId = item.ProductVariantId, Quantity = Math.Min(item.Quantity, max) });
            else
                existing.Quantity = Math.Min(existing.Quantity + item.Quantity, max);
        }
        target.CouponCode ??= anonymous.CouponCode;
        target.ModifiedUtc = clock.UtcNow;

        db.CartItems.RemoveRange(anonymous.Items);
        db.Carts.Remove(anonymous);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Merged anonymous cart into customer {CustomerId}'s cart", customerId);
        return await GetAsync(customerOwner, null, ct);
    }
}
