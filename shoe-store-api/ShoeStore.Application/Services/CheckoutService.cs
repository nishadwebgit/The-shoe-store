using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Options;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services;

public interface ICheckoutService
{
    Task<CartTotalsDto> QuoteAsync(CartOwner owner, CheckoutQuoteRequest request, CancellationToken ct);
    Task<OrderDto> PlaceOrderAsync(CartOwner owner, CheckoutRequest request, CancellationToken ct);
}

/// <summary>
/// Turns a cart into an order inside a single database transaction:
/// re-prices every line from the catalogue, validates the coupon and delivery method,
/// reserves stock with atomic conditional updates (no overselling), records a simulated
/// payment, snapshots order details and clears the cart.
/// </summary>
public sealed class CheckoutService(
    IAppDbContext db,
    ICartService carts,
    IClock clock,
    IOptions<PricingOptions> pricingOptions,
    IOptions<PayHereOptions> payHereOptions,
    IOptions<PaymentOptions> paymentOptions,
    IInventoryLedger ledger,
    ILogger<CheckoutService> logger) : ICheckoutService
{
    private readonly PricingOptions _pricing = pricingOptions.Value;
    private readonly PayHereOptions _payHere = payHereOptions.Value;
    private readonly PaymentOptions _payments = paymentOptions.Value;

    /// <summary>Resolves the requested payment method: "payhere" (card) or "simulated" (demo, dev only).</summary>
    private bool UseCardPayment(string? requested)
    {
        var key = requested?.Trim().ToLowerInvariant();
        switch (key)
        {
            case "payhere" or "card":
                if (!_payHere.IsConfigured)
                    throw new BusinessRuleException("Card payments aren't available right now. Please try again later.", "payments_unavailable");
                return true;
            case "simulated" or "demo":
                if (!_payments.AllowSimulated)
                    throw new BusinessRuleException("Demo payments are turned off. Pay by card to continue.", "simulated_payments_disabled");
                return false;
            case null or "":
                if (_payHere.IsConfigured) return true;
                if (_payments.AllowSimulated) return false;
                throw new BusinessRuleException("Card payments aren't available right now. Please try again later.", "payments_unavailable");
            default:
                throw new BusinessRuleException($"\"{key}\" isn't a payment method we accept.", "invalid_payment_method");
        }
    }

    private async Task<ShippingMethod> GetShippingMethodAsync(string code, string? district, CancellationToken ct)
    {
        var key = code.Trim().ToLowerInvariant();
        var method = await db.ShippingMethods.AsNoTracking().FirstOrDefaultAsync(m => m.Code == key && m.IsActive, ct)
                     ?? throw new BusinessRuleException($"\"{key}\" isn't a delivery option. Choose standard, express or pickup.", "invalid_delivery_method");
        if (!string.IsNullOrWhiteSpace(district) && !method.ServesDistrict(district))
            throw new BusinessRuleException($"{method.Name} isn't available in {district}. Choose another delivery option.", "delivery_unavailable");
        return method;
    }

    public async Task<CartTotalsDto> QuoteAsync(CartOwner owner, CheckoutQuoteRequest request, CancellationToken ct)
    {
        var method = await GetShippingMethodAsync(request.DeliveryMethod, request.District, ct);
        var cart = await carts.LoadCartAsync(owner, tracked: false, ct);
        var pricing = await carts.PriceAsync(cart, method, request.CouponCode, ct);
        return new CartTotalsDto(
            pricing.ItemCount, pricing.Subtotal, pricing.SaleSavings, pricing.Discount,
            pricing.AppliedCoupon?.Code, pricing.AppliedCoupon?.Description, pricing.CouponError,
            pricing.Shipping, method.Code, pricing.Total, pricing.AmountToFreeShipping, _pricing.Currency);
    }

    public async Task<OrderDto> PlaceOrderAsync(CartOwner owner, CheckoutRequest request, CancellationToken ct)
    {
        if (!owner.HasOwner)
            throw new BusinessRuleException("Your bag is empty. Add a pair before checking out.", "cart_empty");

        var address = request.ShippingAddress;
        var cardPayment = UseCardPayment(request.PaymentMethod);
        var method = await GetShippingMethodAsync(request.DeliveryMethod, address.District, ct);

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var cart = await carts.LoadCartAsync(owner, tracked: true, ct);
        if (cart is null || cart.Items.Count == 0)
            throw new BusinessRuleException("Your bag is empty. Add a pair before checking out.", "cart_empty");

        // Validate every line against the live catalogue before touching stock.
        foreach (var item in cart.Items)
        {
            var product = item.ProductVariant.Product;
            if (!product.IsActive)
                throw new ConflictException($"{product.Name} is no longer available. Remove it from your bag to continue.", "product_unavailable");
            if (item.Quantity < 1 || item.Quantity > _pricing.MaxQuantityPerLine)
                throw new BusinessRuleException($"The quantity of {product.Name} isn't valid.", "invalid_quantity");
        }

        // Coupon from the request takes precedence over the one saved on the cart.
        var couponCode = string.IsNullOrWhiteSpace(request.CouponCode) ? cart.CouponCode : request.CouponCode;
        var pricing = await carts.PriceAsync(cart, method, couponCode, ct);
        if (!string.IsNullOrWhiteSpace(request.CouponCode) && pricing.CouponError is not null)
            throw new BusinessRuleException(pricing.CouponError, "invalid_coupon");

        var now = clock.UtcNow;
        var orderNumber = await GenerateOrderNumberAsync(now, ct);

        // Reserve stock atomically through the inventory ledger: the UPDATE only succeeds while enough
        // stock remains, so two shoppers buying the last pair at the same time can never both succeed.
        // Each reservation is recorded as a "Sale" inventory transaction.
        foreach (var item in cart.Items)
        {
            var variantId = item.ProductVariantId;
            var quantity = item.Quantity;
            var movement = await ledger.TryApplyAsync(
                variantId, -quantity, InventoryTransactionType.Sale, "Reserved for customer order", orderNumber, Actor.Checkout, ct);

            if (movement is null)
            {
                var remaining = await db.ProductVariants.AsNoTracking()
                    .Where(v => v.Id == variantId).Select(v => v.StockQuantity).FirstAsync(ct);
                logger.LogWarning("Inventory conflict on {Sku}: wanted {Quantity}, {Remaining} left", item.ProductVariant.Sku, quantity, remaining);
                await transaction.RollbackAsync(ct);
                var product = item.ProductVariant.Product;
                throw new ConflictException(
                    remaining > 0
                        ? $"{product.Name} (UK {item.ProductVariant.Size.Label}) now has only {remaining} left. Update your bag and try again."
                        : $"{product.Name} (UK {item.ProductVariant.Size.Label}) has just sold out. Remove it from your bag to continue.",
                    "insufficient_stock");
            }
        }

        // Count coupon usage atomically too, respecting usage limits.
        if (pricing.AppliedCoupon is { } coupon)
        {
            var couponId = coupon.Id;
            var used = await db.Coupons
                .Where(c => c.Id == couponId && (c.UsageLimit == null || c.TimesUsed < c.UsageLimit))
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.TimesUsed, c => c.TimesUsed + 1), ct);
            if (used == 0)
            {
                await transaction.RollbackAsync(ct);
                throw new ConflictException($"{coupon.Code} has just reached its usage limit. Remove it to continue.", "coupon_exhausted");
            }
        }

        var (deliveryFrom, deliveryTo) = DeliveryEstimator.Estimate(method, now);
        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderNumber = orderNumber,
            CustomerId = owner.CustomerId,
            Email = request.Email.Trim().ToLowerInvariant(),
            Status = OrderStatus.Pending,
            PaymentStatus = cardPayment ? PaymentStatus.Pending : PaymentStatus.Simulated,
            PaymentProvider = cardPayment ? "PayHere" : "Simulated",
            PaymentExpiresUtc = cardPayment ? now.AddMinutes(Math.Max(5, _payHere.PaymentWindowMinutes)) : null,
            ShippingMethodCode = method.Code,
            ShippingMethodName = method.Name,
            EstimatedDeliveryFromUtc = deliveryFrom,
            EstimatedDeliveryToUtc = deliveryTo,
            Currency = _pricing.Currency,
            Subtotal = pricing.Subtotal,
            DiscountTotal = pricing.Discount,
            ShippingTotal = pricing.Shipping,
            GrandTotal = pricing.Total,
            CouponCode = pricing.AppliedCoupon?.Code,
            PlacedUtc = now,
            ShippingAddress = new OrderAddress
            {
                FirstName = address.FirstName.Trim(),
                LastName = address.LastName.Trim(),
                Line1 = address.Line1.Trim(),
                Line2 = string.IsNullOrWhiteSpace(address.Line2) ? null : address.Line2.Trim(),
                City = address.City.Trim(),
                District = address.District.Trim(),
                PostalCode = address.PostalCode.Trim(),
                Phone = address.Phone.Trim(),
            },
        };

        foreach (var item in cart.Items.OrderBy(i => i.Id))
        {
            var v = item.ProductVariant;
            order.Items.Add(new OrderItem
            {
                ProductVariantId = v.Id,
                Sku = v.Sku,
                ProductCode = v.Product.Code,
                ProductSlug = v.Product.Slug,
                ProductName = v.Product.Name,
                BrandName = v.Product.Brand.Name,
                ColourCode = v.Colour.Code,
                ColourName = v.Colour.Name,
                Size = v.Size.Code,
                ImageUrl = v.Colour.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                UnitPrice = v.Product.Price,
                Quantity = item.Quantity,
                LineTotal = v.Product.Price * item.Quantity,
            });
        }

        order.StatusHistory.Add(new OrderStatusHistory
        {
            Status = OrderStatus.Pending,
            Note = cardPayment
                ? "Order placed. Awaiting card payment via PayHere."
                : "Order placed. Payment simulated: no money was taken.",
            CreatedUtc = now,
        });

        db.Orders.Add(order);

        if (owner.CustomerId is { } customerId && request.SaveAddress)
            await SaveDefaultAddressAsync(customerId, address, ct);

        // The purchased items leave the cart; the cart itself is removed.
        db.CartItems.RemoveRange(cart.Items);
        db.Carts.Remove(cart);

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        logger.LogInformation(
            "Order {OrderNumber} placed ({ItemCount} items, {Total} {Currency}, customer {CustomerId})",
            order.OrderNumber, pricing.ItemCount, order.GrandTotal, order.Currency, order.CustomerId?.ToString() ?? "guest");

        return order.ToDto();
    }

    private async Task SaveDefaultAddressAsync(Guid customerId, CheckoutAddressRequest a, CancellationToken ct)
    {
        var addresses = await db.CustomerAddresses.Where(x => x.CustomerId == customerId).ToListAsync(ct);
        var match = addresses.FirstOrDefault(x =>
            string.Equals(x.Line1.Trim(), a.Line1.Trim(), StringComparison.OrdinalIgnoreCase) &&
            string.Equals(x.PostalCode.Trim(), a.PostalCode.Trim(), StringComparison.OrdinalIgnoreCase));

        foreach (var existing in addresses) existing.IsDefault = false;

        if (match is null)
        {
            match = new CustomerAddress { CustomerId = customerId };
            db.CustomerAddresses.Add(match);
        }

        match.FirstName = a.FirstName.Trim();
        match.LastName = a.LastName.Trim();
        match.Line1 = a.Line1.Trim();
        match.Line2 = string.IsNullOrWhiteSpace(a.Line2) ? null : a.Line2.Trim();
        match.City = a.City.Trim();
        match.District = a.District.Trim();
        match.PostalCode = a.PostalCode.Trim();
        match.Phone = a.Phone.Trim();
        match.IsDefault = true;
    }

    /// <summary>Human-friendly order number, e.g. NS-2611-48302 (prefix, yyMM, random digits).</summary>
    private async Task<string> GenerateOrderNumberAsync(DateTime now, CancellationToken ct)
    {
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var candidate = $"NS-{now:yyMM}-{RandomNumberGenerator.GetInt32(10000, 100000)}";
            if (!await db.Orders.AnyAsync(o => o.OrderNumber == candidate, ct)) return candidate;
        }
        return $"NS-{now:yyMM}-{RandomNumberGenerator.GetInt32(100000, 1000000)}";
    }
}
