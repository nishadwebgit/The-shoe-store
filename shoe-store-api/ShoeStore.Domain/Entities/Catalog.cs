using ShoeStore.Domain.Common;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Domain.Entities;

public class Brand : AuditableEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? Description { get; set; }

    public ICollection<Product> Products { get; set; } = new List<Product>();
}

/// <summary>Style category such as running, lifestyle or boots.</summary>
public class Category : AuditableEntity
{
    public int Id { get; set; }

    /// <summary>Stable code used in URLs and by the frontend, e.g. "running".</summary>
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int DisplayOrder { get; set; }

    public ICollection<ProductCategory> ProductCategories { get; set; } = new List<ProductCategory>();
}

/// <summary>Shoe size lookup (UK sizing). Kids sizes carry a "K" suffix in their code.</summary>
public class Size
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public SizeSystem SizeSystem { get; set; }
    public int SortOrder { get; set; }
}

public class Product : AuditableEntity
{
    public int Id { get; set; }

    /// <summary>Public product code (e.g. "P001"). Exposed to clients as the product id.</summary>
    public string Code { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    public int BrandId { get; set; }
    public Brand Brand { get; set; } = null!;

    public Gender Gender { get; set; }
    public SizeSystem SizeSystem { get; set; }
    public FitType Fit { get; set; }

    /// <summary>Shoe type (runner, court, boot…), used for merchandising copy.</summary>
    public string Silhouette { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;
    public string Materials { get; set; } = string.Empty;
    public string Care { get; set; } = string.Empty;

    public decimal Price { get; set; }
    public decimal? OriginalPrice { get; set; }

    /// <summary>Average rating (denormalised for fast sorting/filtering).</summary>
    public decimal Rating { get; set; }
    public int ReviewCount { get; set; }

    public bool IsFeatured { get; set; }
    public bool IsNewArrival { get; set; }
    public bool IsBestSeller { get; set; }
    public bool IsActive { get; set; } = true;

    public DateTime ReleasedUtc { get; set; }

    /// <summary>Merchandising popularity score used by the "most popular" sort.</summary>
    public int Popularity { get; set; }

    public ICollection<ProductCategory> ProductCategories { get; set; } = new List<ProductCategory>();
    public ICollection<ProductColour> Colours { get; set; } = new List<ProductColour>();
    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
    public ICollection<ProductHighlight> Highlights { get; set; } = new List<ProductHighlight>();
    public ICollection<ProductSpecification> Specifications { get; set; } = new List<ProductSpecification>();
    public ICollection<ProductReview> Reviews { get; set; } = new List<ProductReview>();

    public bool IsOnSale => OriginalPrice.HasValue && OriginalPrice.Value > Price;
}

public class ProductCategory
{
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;
}

public class ProductHighlight
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string Text { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public class ProductSpecification
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string Label { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

/// <summary>A colourway of a product, with its own photos.</summary>
public class ProductColour
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    /// <summary>Code unique within the product, e.g. "white".</summary>
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string SwatchHex { get; set; } = string.Empty;

    /// <summary>Colour family used by the colour filter, e.g. "black".</summary>
    public string Family { get; set; } = string.Empty;
    public int SortOrder { get; set; }

    public ICollection<ProductImage> Images { get; set; } = new List<ProductImage>();
    public ICollection<ProductVariant> Variants { get; set; } = new List<ProductVariant>();
}

public class ProductImage
{
    public int Id { get; set; }
    public int ProductColourId { get; set; }
    public string Url { get; set; } = string.Empty;
    public string? AltText { get; set; }

    /// <summary>The first image (lowest sort order) is the primary image.</summary>
    public int SortOrder { get; set; }

    /// <summary>Storage key for images uploaded through the Owner Portal; null for external URLs.</summary>
    public string? StorageKey { get; set; }
}

/// <summary>A sellable SKU: one colour in one size. Inventory is tracked here.</summary>
public class ProductVariant : AuditableEntity
{
    public int Id { get; set; }
    public string Sku { get; set; } = string.Empty;

    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public int ProductColourId { get; set; }
    public ProductColour Colour { get; set; } = null!;

    public int SizeId { get; set; }
    public Size Size { get; set; } = null!;

    public int StockQuantity { get; set; }

    /// <summary>Overrides the store-wide low-stock threshold for this variant.</summary>
    public int? LowStockThreshold { get; set; }

    /// <summary>Optimistic concurrency token (SQL Server rowversion).</summary>
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();
}

public class ProductReview
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public Guid? CustomerId { get; set; }

    public string AuthorName { get; set; } = string.Empty;
    public string? Location { get; set; }
    public int Rating { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public FitType Fit { get; set; }
    public string? SizePurchased { get; set; }
    public bool IsVerifiedPurchase { get; set; }
    public DateTime CreatedUtc { get; set; }
}
