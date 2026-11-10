namespace ShoeStore.Application.Dtos;

// DTO shapes mirror the React app's TypeScript types (src/types/index.ts) so the frontend
// can consume responses without reshaping. JSON is camelCase.

// ------------------------------------------------------------------ Catalogue

public sealed record ColourDto(string Id, string Name, string Swatch, string Family, IReadOnlyList<string> Images);

public sealed record VariantDto(string Sku, string ColourId, string Size, int Stock);

public sealed record SpecificationDto(string Label, string Value);

public sealed record ProductDto(
    string Id,
    string Slug,
    string Name,
    string Brand,
    string Gender,
    IReadOnlyList<string> Categories,
    string Description,
    IReadOnlyList<string> Highlights,
    decimal Price,
    decimal? OriginalPrice,
    IReadOnlyList<ColourDto> Colours,
    IReadOnlyList<string> Sizes,
    string SizeSystem,
    IReadOnlyList<VariantDto> Variants,
    decimal Rating,
    int ReviewCount,
    IReadOnlyList<SpecificationDto> Specifications,
    string Materials,
    string Care,
    string Fit,
    bool IsFeatured,
    bool IsNewArrival,
    bool IsBestSeller,
    DateTime ReleasedAt,
    int Popularity,
    string Silhouette);

/// <summary>Lightweight product card data (wishlist and similar lists).</summary>
public sealed record ProductSummaryDto(
    string Id,
    string Slug,
    string Name,
    string Brand,
    decimal Price,
    decimal? OriginalPrice,
    string? Image,
    decimal Rating,
    int ReviewCount,
    bool InStock);

public sealed record FacetValueDto(string Value, string Label, int Count);

public sealed record ColourFacetDto(string Value, string Label, int Count, string Swatch);

public sealed record SizeFacetsDto(IReadOnlyList<FacetValueDto> Adult, IReadOnlyList<FacetValueDto> Kids);

public sealed record PriceRangeDto(decimal Min, decimal Max);

public sealed record ProductFacetsDto(
    IReadOnlyList<FacetValueDto> Genders,
    IReadOnlyList<FacetValueDto> Categories,
    IReadOnlyList<FacetValueDto> Brands,
    SizeFacetsDto Sizes,
    IReadOnlyList<ColourFacetDto> Colours,
    PriceRangeDto PriceRange);

/// <summary>Paged product search result with filter facets.</summary>
public sealed record ProductSearchResultDto(
    IReadOnlyList<ProductDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    int TotalPages,
    ProductFacetsDto Facets);

/// <summary>Query-string parameters for product search. List parameters are comma-separated.</summary>
public sealed class ProductQueryParameters
{
    /// <summary>Free-text search over name, brand, category and colour.</summary>
    public string? Search { get; set; }
    /// <summary>men, women, kids (comma-separated). Unisex shoes match men and women.</summary>
    public string? Gender { get; set; }
    /// <summary>Category codes, e.g. running,lifestyle.</summary>
    public string? Category { get; set; }
    /// <summary>Brand names or slugs, e.g. Nike,New Balance.</summary>
    public string? Brand { get; set; }
    /// <summary>UK size codes with stock, e.g. 8,9 or 12K.</summary>
    public string? Size { get; set; }
    /// <summary>Colour families, e.g. black,white.</summary>
    public string? Colour { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public decimal? MinRating { get; set; }
    /// <summary>Only products with at least one size in stock.</summary>
    public bool? InStock { get; set; }
    /// <summary>Only discounted products.</summary>
    public bool? OnSale { get; set; }
    /// <summary>new, best-sellers or featured.</summary>
    public string? Collection { get; set; }
    /// <summary>featured (default), newest, popular, price-asc, price-desc, rating.</summary>
    public string? Sort { get; set; }
    /// <summary>Product ids (codes) to fetch, e.g. P001,P002.</summary>
    public string? Ids { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 12;
}

public sealed record ReviewDto(
    string Id,
    string ProductId,
    string Author,
    string? Location,
    int Rating,
    string Title,
    string Body,
    string Fit,
    string? SizePurchased,
    DateTime CreatedAt,
    bool Verified);

public sealed record CategoryDto(
    string Id,
    string Label,
    string? Description,
    string? Image,
    int ProductCount,
    IReadOnlyDictionary<string, string> Query);

public sealed record BrandDto(int Id, string Name, string Slug, string? Description, int ProductCount);

public sealed record SizeDto(string Code, string Label, string SizeSystem);

public sealed record StockDto(string Sku, string ProductId, string ColourId, string Size, int Available, bool InStock);

public sealed record StockCheckRequest(IReadOnlyList<string> Skus);

public sealed record StockCheckResultDto(string Sku, int Available);

// ------------------------------------------------------------------ Customers & auth

public sealed record AddressDto(
    int Id,
    string FirstName,
    string LastName,
    string Line1,
    string? Line2,
    string City,
    string District,
    string PostalCode,
    string Phone,
    bool IsDefault);

public sealed record AddressRequest(
    string FirstName,
    string LastName,
    string Line1,
    string? Line2,
    string City,
    string District,
    string PostalCode,
    string Phone,
    bool IsDefault = false);

public sealed record CustomerDto(
    Guid Id,
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    DateTime CreatedAt,
    AddressDto? DefaultAddress,
    string? PreferredSize,
    bool MarketingOptIn,
    string Role);

public sealed record RegisterRequest(string FirstName, string LastName, string Email, string Password, bool MarketingOptIn);

public sealed record LoginRequest(string Email, string Password);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record UpdateProfileRequest(string FirstName, string LastName, string? Phone, string? PreferredSize, bool MarketingOptIn);

/// <summary>Returned on sign-in, registration and refresh. The refresh token travels in an HttpOnly cookie.</summary>
public sealed record AuthResponse(string AccessToken, DateTime ExpiresAt, CustomerDto Customer);

/// <summary>Internal result carrying the raw refresh token so the API layer can set the cookie.</summary>
public sealed record AuthResult(AuthResponse Response, string RefreshToken, DateTime RefreshTokenExpiresUtc);

// ------------------------------------------------------------------ Cart & wishlist

public sealed record CartLineDto(
    string Id,
    string Sku,
    string ProductId,
    string Slug,
    string Name,
    string Brand,
    string ColourId,
    string ColourName,
    string Size,
    string Image,
    decimal UnitPrice,
    decimal? OriginalUnitPrice,
    int Quantity,
    int MaxQuantity);

public sealed record CartTotalsDto(
    int ItemCount,
    decimal Subtotal,
    decimal SaleSavings,
    decimal Discount,
    string? DiscountCode,
    string? DiscountDescription,
    string? DiscountError,
    decimal Shipping,
    string ShippingMethod,
    decimal Total,
    decimal AmountToFreeShipping,
    string Currency);

/// <param name="CartToken">Anonymous cart token; guests send it back in the X-Cart-Token header.</param>
public sealed record CartDto(
    Guid? CartToken,
    IReadOnlyList<CartLineDto> Lines,
    string? DiscountCode,
    DateTime UpdatedAt,
    CartTotalsDto Totals);

public sealed record AddCartItemRequest(string ProductId, string ColourId, string Size, int Quantity);

public sealed record UpdateCartItemRequest(int Quantity);

public sealed record ApplyCouponRequest(string Code);

public sealed record WishlistItemDto(string ProductId, DateTime AddedAt, ProductSummaryDto Product);

public sealed record WishlistDto(IReadOnlyList<WishlistItemDto> Items)
{
    public IReadOnlyList<string> ProductIds => Items.Select(i => i.ProductId).ToList();
}

public sealed record AddWishlistItemRequest(string ProductId);

public sealed record MergeWishlistRequest(IReadOnlyList<string> ProductIds);

// ------------------------------------------------------------------ Coupons & shipping

public sealed record CouponDto(
    string Code,
    string Description,
    string Type,
    decimal Value,
    decimal? MinSubtotal,
    bool IsValid,
    string? Message,
    decimal DiscountAmount);

public sealed record DeliveryEstimateDto(DateTime From, DateTime To);

public sealed record ShippingMethodDto(
    string Id,
    string Label,
    string Description,
    int MinBusinessDays,
    int MaxBusinessDays,
    decimal BaseFee,
    decimal Fee,
    bool FreeOverThreshold,
    IReadOnlyList<string>? RestrictedToDistricts,
    bool Available,
    DeliveryEstimateDto EstimatedDelivery);

// ------------------------------------------------------------------ Checkout & orders

public sealed record CheckoutAddressRequest(
    string FirstName,
    string LastName,
    string Line1,
    string? Line2,
    string City,
    string District,
    string PostalCode,
    string Phone);

/// <summary>
/// Places an order from the caller's server-side cart. Prices, discounts, shipping and totals
/// are always recalculated by the server; any client-side figures are ignored.
/// </summary>
public sealed record CheckoutRequest(
    string Email,
    CheckoutAddressRequest ShippingAddress,
    string DeliveryMethod,
    string? CouponCode,
    bool SaveAddress = false,
    string? PaymentMethod = null);

public sealed record CheckoutQuoteRequest(string DeliveryMethod, string? District, string? CouponCode);

public sealed record OrderLineDto(
    string Sku,
    string ProductId,
    string Slug,
    string Name,
    string Brand,
    string ColourId,
    string ColourName,
    string Size,
    string? Image,
    decimal UnitPrice,
    int Quantity,
    decimal LineTotal);

public sealed record OrderAddressDto(
    string FirstName,
    string LastName,
    string Line1,
    string? Line2,
    string City,
    string District,
    string PostalCode,
    string Phone);

public sealed record OrderStatusEntryDto(string Status, string? Note, DateTime At);

public sealed record OrderDto(
    Guid Id,
    string OrderNumber,
    Guid? CustomerId,
    string Email,
    DateTime PlacedAt,
    string Status,
    string PaymentStatus,
    string PaymentMethod,
    IReadOnlyList<OrderLineDto> Lines,
    OrderAddressDto ShippingAddress,
    string DeliveryMethod,
    string DeliveryMethodName,
    DeliveryEstimateDto EstimatedDelivery,
    decimal Subtotal,
    decimal Discount,
    string? DiscountCode,
    decimal Shipping,
    decimal Total,
    string Currency,
    IReadOnlyList<OrderStatusEntryDto> StatusHistory,
    string PaymentProvider,
    DateTime? PaymentExpiresAt);

/// <summary>Which payment methods the storefront may offer.</summary>
public sealed record PaymentOptionsDto(bool CardPaymentsEnabled, bool SimulatedPaymentsEnabled, bool Sandbox);

/// <summary>Starts PayHere hosted checkout for an order awaiting payment.</summary>
public sealed record StartPayHereCheckoutRequest(string OrderNumber, string? Email);

/// <summary>
/// Fields the browser posts to the gateway's hosted checkout page. The hash is computed on the
/// server so the merchant secret never leaves it.
/// </summary>
public sealed record HostedCheckoutDto(string ActionUrl, IReadOnlyDictionary<string, string> Fields, DateTime? ExpiresAt);

public sealed record OrderStatusDto(string OrderNumber, string Status, string PaymentStatus, DeliveryEstimateDto EstimatedDelivery);
