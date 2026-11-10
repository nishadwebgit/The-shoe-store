using ShoeStore.Domain.Common;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Domain.Entities;

/// <summary>
/// Shopping cart. Belongs either to a signed-in customer or to an anonymous visitor
/// (identified by <see cref="AnonymousId"/>), so guest shoppers can still check out.
/// An anonymous cart is merged into the customer's cart when they sign in.
/// </summary>
public class Cart : AuditableEntity
{
    public Guid Id { get; set; }
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public Guid? AnonymousId { get; set; }
    public string? CouponCode { get; set; }

    public ICollection<CartItem> Items { get; set; } = new List<CartItem>();
}

public class CartItem : AuditableEntity
{
    public int Id { get; set; }
    public Guid CartId { get; set; }
    public Cart Cart { get; set; } = null!;
    public int ProductVariantId { get; set; }
    public ProductVariant ProductVariant { get; set; } = null!;
    public int Quantity { get; set; }
}

public class Wishlist : AuditableEntity
{
    public int Id { get; set; }
    public Guid CustomerId { get; set; }
    public Customer Customer { get; set; } = null!;
    public ICollection<WishlistItem> Items { get; set; } = new List<WishlistItem>();
}

public class WishlistItem
{
    public int Id { get; set; }
    public int WishlistId { get; set; }
    public Wishlist Wishlist { get; set; } = null!;
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public DateTime CreatedUtc { get; set; }
}

public class Coupon : AuditableEntity
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public CouponType Type { get; set; }

    /// <summary>Percentage (for Percent) or amount in LKR (for Fixed). Ignored for FreeShipping.</summary>
    public decimal Value { get; set; }
    public decimal? MinSubtotal { get; set; }
    public DateTime? StartsUtc { get; set; }
    public DateTime? EndsUtc { get; set; }
    public int? UsageLimit { get; set; }
    public int TimesUsed { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ShippingMethod : AuditableEntity
{
    public int Id { get; set; }

    /// <summary>Stable code used by clients: standard, express, pickup.</summary>
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int MinBusinessDays { get; set; }
    public int MaxBusinessDays { get; set; }
    public decimal Fee { get; set; }

    /// <summary>When true, the free-shipping threshold makes this method free.</summary>
    public bool FreeOverThreshold { get; set; }

    /// <summary>Comma-separated list of districts this method serves; null means island-wide.</summary>
    public string? RestrictedToDistricts { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }

    public bool ServesDistrict(string district)
    {
        if (string.IsNullOrWhiteSpace(RestrictedToDistricts)) return true;
        return RestrictedToDistricts
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Contains(district.Trim(), StringComparer.OrdinalIgnoreCase);
    }
}
