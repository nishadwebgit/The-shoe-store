using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Options;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services;

public interface IOrderService
{
    Task<PagedResult<OrderDto>> GetForCustomerAsync(Guid customerId, int page, int pageSize, CancellationToken ct);

    /// <summary>
    /// Gets one order. Customers can only see their own orders; guest orders require the
    /// email used at checkout. Anything else is reported as "not found" so order numbers can't be probed.
    /// </summary>
    Task<OrderDto> GetAsync(string orderNumber, Guid? customerId, bool isAdmin, string? guestEmail, CancellationToken ct);
}

public sealed class OrderService(IAppDbContext db) : IOrderService
{
    private IQueryable<Order> WithDetails() => db.Orders
        .AsNoTracking()
        .AsSplitQuery()
        .Include(o => o.Items)
        .Include(o => o.ShippingAddress)
        .Include(o => o.StatusHistory);

    public async Task<PagedResult<OrderDto>> GetForCustomerAsync(Guid customerId, int page, int pageSize, CancellationToken ct)
    {
        pageSize = Math.Clamp(pageSize, 1, 50);
        page = Math.Max(1, page);
        var query = db.Orders.AsNoTracking().Where(o => o.CustomerId == customerId);
        var total = await query.CountAsync(ct);
        var ids = await query.OrderByDescending(o => o.PlacedUtc)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(o => o.Id).ToListAsync(ct);
        var orders = await WithDetails().Where(o => ids.Contains(o.Id)).ToListAsync(ct);
        var items = orders.OrderByDescending(o => o.PlacedUtc).Select(o => o.ToDto()).ToList();
        return PagedResult<OrderDto>.Create(items, page, pageSize, total);
    }

    public async Task<OrderDto> GetAsync(string orderNumber, Guid? customerId, bool isAdmin, string? guestEmail, CancellationToken ct)
    {
        var number = orderNumber.Trim().ToUpperInvariant();
        var order = await WithDetails().FirstOrDefaultAsync(o => o.OrderNumber == number, ct);
        var notFound = new NotFoundException("We couldn't find that order. Check the order number in your confirmation.", "order_not_found");
        if (order is null) throw notFound;
        if (isAdmin) return order.ToDto();

        if (order.CustomerId is { } owner)
        {
            if (customerId != owner) throw notFound;
        }
        else if (string.IsNullOrWhiteSpace(guestEmail) ||
                 !string.Equals(order.Email, guestEmail.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            throw notFound;
        }

        return order.ToDto();
    }
}

public interface ICouponService
{
    Task<CouponDto> ValidateAsync(string code, decimal? subtotal, CancellationToken ct);
}

public sealed class CouponService(IAppDbContext db, IClock clock) : ICouponService
{
    public async Task<CouponDto> ValidateAsync(string code, decimal? subtotal, CancellationToken ct)
    {
        var normalised = code.Trim().ToUpperInvariant();
        var coupon = await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Code == normalised, ct);
        var amount = subtotal ?? 0m;
        var error = PricingCalculator.ValidateCoupon(coupon, normalised, subtotal ?? decimal.MaxValue, clock.UtcNow);
        if (coupon is null)
            return new CouponDto(normalised, string.Empty, "unknown", 0, null, false, error, 0);

        var discount = error is null && subtotal.HasValue
            ? coupon.Type switch
            {
                CouponType.Percent => Math.Round(amount * coupon.Value / 100m, 0, MidpointRounding.AwayFromZero),
                CouponType.Fixed => Math.Min(coupon.Value, amount),
                _ => 0m,
            }
            : 0m;

        return new CouponDto(coupon.Code, coupon.Description, coupon.Type.ToApi(), coupon.Value, coupon.MinSubtotal, error is null, error, discount);
    }
}

public interface IShippingService
{
    Task<IReadOnlyList<ShippingMethodDto>> GetMethodsAsync(decimal? subtotal, string? district, string? couponCode, CancellationToken ct);
}

public sealed class ShippingService(IAppDbContext db, IClock clock, IOptions<PricingOptions> pricing) : IShippingService
{
    public async Task<IReadOnlyList<ShippingMethodDto>> GetMethodsAsync(decimal? subtotal, string? district, string? couponCode, CancellationToken ct)
    {
        var methods = await db.ShippingMethods.AsNoTracking().Where(m => m.IsActive).OrderBy(m => m.SortOrder).ToListAsync(ct);

        Coupon? coupon = null;
        if (!string.IsNullOrWhiteSpace(couponCode))
        {
            var code = couponCode.Trim().ToUpperInvariant();
            coupon = await db.Coupons.AsNoTracking().FirstOrDefaultAsync(c => c.Code == code, ct);
            if (PricingCalculator.ValidateCoupon(coupon, code, subtotal ?? 0, clock.UtcNow) is not null) coupon = null;
        }

        var now = clock.UtcNow;
        return methods.Select(m =>
        {
            var (deliveryFrom, deliveryTo) = DeliveryEstimator.Estimate(m, now);
            var fee = subtotal.HasValue
                ? PricingCalculator.CalculateShipping(subtotal.Value, m, coupon, pricing.Value.FreeShippingThreshold)
                : m.Fee;
            return new ShippingMethodDto(
                m.Code,
                m.Name,
                m.Description,
                m.MinBusinessDays,
                m.MaxBusinessDays,
                m.Fee,
                fee,
                m.FreeOverThreshold,
                string.IsNullOrWhiteSpace(m.RestrictedToDistricts)
                    ? null
                    : m.RestrictedToDistricts.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                string.IsNullOrWhiteSpace(district) || m.ServesDistrict(district),
                new DeliveryEstimateDto(deliveryFrom, deliveryTo));
        }).ToList();
    }
}

public interface ICatalogService
{
    Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken ct);
    Task<CategoryDto> GetCategoryAsync(string code, CancellationToken ct);
    Task<IReadOnlyList<BrandDto>> GetBrandsAsync(CancellationToken ct);
    Task<BrandDto> GetBrandAsync(string idOrSlug, CancellationToken ct);
    Task<IReadOnlyList<SizeDto>> GetSizesAsync(CancellationToken ct);
}

public sealed class CatalogService(IAppDbContext db) : ICatalogService
{
    private async Task<List<CategoryDto>> LoadCategoriesAsync(CancellationToken ct)
    {
        var rows = await db.Categories.AsNoTracking()
            .OrderBy(c => c.DisplayOrder)
            .Select(c => new
            {
                c.Code,
                c.Name,
                c.Description,
                c.ImageUrl,
                Count = c.ProductCategories.Count(pc => pc.Product.IsActive),
            })
            .ToListAsync(ct);
        return rows.Select(r => new CategoryDto(
            r.Code, r.Name, r.Description, r.ImageUrl, r.Count,
            new Dictionary<string, string> { ["category"] = r.Code })).ToList();
    }

    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(CancellationToken ct) => await LoadCategoriesAsync(ct);

    public async Task<CategoryDto> GetCategoryAsync(string code, CancellationToken ct)
    {
        var key = code.Trim().ToLowerInvariant();
        return (await LoadCategoriesAsync(ct)).FirstOrDefault(c => c.Id == key)
               ?? throw new NotFoundException($"There is no \"{code}\" category.", "category_not_found");
    }

    private static IQueryable<BrandDto> ProjectBrands(IQueryable<Brand> brands) => brands
        .OrderBy(b => b.Name)
        .Select(b => new BrandDto(b.Id, b.Name, b.Slug, b.Description, b.Products.Count(p => p.IsActive)));

    public async Task<IReadOnlyList<BrandDto>> GetBrandsAsync(CancellationToken ct) =>
        await ProjectBrands(db.Brands.AsNoTracking()).ToListAsync(ct);

    public async Task<BrandDto> GetBrandAsync(string idOrSlug, CancellationToken ct)
    {
        var key = idOrSlug.Trim().ToLowerInvariant();
        var id = int.TryParse(key, out var parsed) ? parsed : -1;
        // Filter on the entity first; predicates can't be translated after projecting to a record.
        return await ProjectBrands(db.Brands.AsNoTracking().Where(b => b.Id == id || b.Slug == key)).FirstOrDefaultAsync(ct)
               ?? throw new NotFoundException($"There is no \"{idOrSlug}\" brand.", "brand_not_found");
    }

    public async Task<IReadOnlyList<SizeDto>> GetSizesAsync(CancellationToken ct)
    {
        var sizes = await db.Sizes.AsNoTracking().OrderBy(s => s.SortOrder).ToListAsync(ct);
        return sizes.Select(s => new SizeDto(s.Code, s.Label, s.SizeSystem.ToApi())).ToList();
    }
}
