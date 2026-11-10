using ShoeStore.Application.Dtos;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services;

/// <summary>Enum ⇄ API string conversions. Values match the React app's union types.</summary>
public static class ApiValues
{
    public static string ToApi(this Gender gender) => gender switch
    {
        Gender.Men => "men",
        Gender.Women => "women",
        Gender.Kids => "kids",
        _ => "unisex",
    };

    public static Gender? ParseGender(string value) => value.Trim().ToLowerInvariant() switch
    {
        "men" or "mens" or "man" => Gender.Men,
        "women" or "womens" or "woman" => Gender.Women,
        "kids" or "kid" or "children" => Gender.Kids,
        "unisex" => Gender.Unisex,
        _ => null,
    };

    public static string GenderLabel(Gender gender) => gender switch
    {
        Gender.Men => "Men",
        Gender.Women => "Women",
        Gender.Kids => "Kids",
        _ => "Unisex",
    };

    public static string ToApi(this FitType fit) => fit switch
    {
        FitType.RunsSmall => "small",
        FitType.RunsLarge => "large",
        _ => "true",
    };

    public static string ToApi(this SizeSystem system) => system == SizeSystem.Kids ? "kids" : "adult";

    public static string ToApi(this OrderStatus status) => status switch
    {
        OrderStatus.ReadyForDispatch => "ready-for-dispatch",
        _ => status.ToString().ToLowerInvariant(),
    };

    public static OrderStatus? ParseOrderStatus(string value) => value.Trim().ToLowerInvariant().Replace("_", "-") switch
    {
        "pending" => OrderStatus.Pending,
        "confirmed" => OrderStatus.Confirmed,
        "processing" => OrderStatus.Processing,
        "ready-for-dispatch" or "readyfordispatch" => OrderStatus.ReadyForDispatch,
        "shipped" => OrderStatus.Shipped,
        "delivered" => OrderStatus.Delivered,
        "cancelled" or "canceled" => OrderStatus.Cancelled,
        _ => null,
    };

    public static PaymentStatus? ParsePaymentStatus(string value) =>
        Enum.TryParse<PaymentStatus>(value.Trim(), ignoreCase: true, out var status) ? status : null;

    public static string ToApi(this InventoryTransactionType type) => type.ToString().ToLowerInvariant();

    public static InventoryTransactionType? ParseTransactionType(string value) =>
        Enum.TryParse<InventoryTransactionType>(value.Trim(), ignoreCase: true, out var type) ? type : null;

    public static string ToApi(this PaymentStatus status) => status.ToString().ToLowerInvariant();

    public static string ToApi(this CouponType type) => type switch
    {
        CouponType.Percent => "percent",
        CouponType.Fixed => "fixed",
        _ => "free-shipping",
    };

    /// <summary>Colour families used by the colour filter (labels and swatches shown in the UI).</summary>
    public static readonly IReadOnlyList<(string Value, string Label, string Swatch)> ColourFamilies =
    [
        ("black", "Black", "#1b1d22"),
        ("white", "White", "#f6f5f1"),
        ("grey", "Grey", "#8a9099"),
        ("navy", "Navy", "#1f2a44"),
        ("blue", "Blue", "#2f7bc8"),
        ("green", "Green", "#3f7254"),
        ("red", "Red", "#c0392b"),
        ("orange", "Orange", "#ef6a3a"),
        ("pink", "Pink", "#e9806e"),
        ("purple", "Purple", "#9b87cc"),
        ("yellow", "Yellow", "#f2c230"),
        ("beige", "Beige", "#d8c3a0"),
        ("brown", "Brown", "#8a5430"),
    ];

    public static IReadOnlyList<string> SplitList(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? Array.Empty<string>()
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
}

/// <summary>Entity → DTO mapping. Kept manual and explicit (no reflection-based mapper).</summary>
public static class Mapper
{
    /// <summary>Requires Brand, ProductCategories.Category, Colours.Images, Variants.Size, Highlights and Specifications.</summary>
    public static ProductDto ToDto(this Product p)
    {
        var colours = p.Colours.OrderBy(c => c.SortOrder).ToList();
        var variants = p.Variants
            .OrderBy(v => colours.FindIndex(c => c.Id == v.ProductColourId))
            .ThenBy(v => v.Size.SortOrder)
            .ToList();

        return new ProductDto(
            p.Code,
            p.Slug,
            p.Name,
            p.Brand.Name,
            p.Gender.ToApi(),
            p.ProductCategories.OrderBy(pc => pc.Category.DisplayOrder).Select(pc => pc.Category.Code).ToList(),
            p.Description,
            p.Highlights.OrderBy(h => h.SortOrder).Select(h => h.Text).ToList(),
            p.Price,
            p.OriginalPrice,
            colours.Select(c => new ColourDto(
                c.Code,
                c.Name,
                c.SwatchHex,
                c.Family,
                c.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).ToList())).ToList(),
            p.Variants.Select(v => v.Size).DistinctBy(s => s.Id).OrderBy(s => s.SortOrder).Select(s => s.Code).ToList(),
            p.SizeSystem.ToApi(),
            variants.Select(v => new VariantDto(
                v.Sku,
                colours.First(c => c.Id == v.ProductColourId).Code,
                v.Size.Code,
                Math.Max(0, v.StockQuantity))).ToList(),
            p.Rating,
            p.ReviewCount,
            p.Specifications.OrderBy(s => s.SortOrder).Select(s => new SpecificationDto(s.Label, s.Value)).ToList(),
            p.Materials,
            p.Care,
            p.Fit.ToApi(),
            p.IsFeatured,
            p.IsNewArrival,
            p.IsBestSeller,
            p.ReleasedUtc,
            p.Popularity,
            p.Silhouette);
    }

    public static ProductSummaryDto ToSummaryDto(this Product p)
    {
        var firstColour = p.Colours.OrderBy(c => c.SortOrder).FirstOrDefault();
        var image = firstColour?.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault();
        return new ProductSummaryDto(
            p.Code, p.Slug, p.Name, p.Brand.Name, p.Price, p.OriginalPrice, image, p.Rating, p.ReviewCount,
            p.Variants.Any(v => v.StockQuantity > 0));
    }

    public static ReviewDto ToDto(this ProductReview r, string productCode) => new(
        $"{productCode}-r{r.Id}",
        productCode,
        r.AuthorName,
        r.Location,
        r.Rating,
        r.Title,
        r.Body,
        r.Fit.ToApi(),
        r.SizePurchased,
        r.CreatedUtc,
        r.IsVerifiedPurchase);

    public static AddressDto ToDto(this CustomerAddress a) => new(
        a.Id, a.FirstName, a.LastName, a.Line1, a.Line2, a.City, a.District, a.PostalCode, a.Phone, a.IsDefault);

    public static CustomerDto ToDto(this Customer c)
    {
        var defaultAddress = c.Addresses.FirstOrDefault(a => a.IsDefault) ?? c.Addresses.OrderBy(a => a.Id).FirstOrDefault();
        return new CustomerDto(
            c.Id,
            c.FirstName,
            c.LastName,
            c.Email,
            c.Phone,
            c.CreatedUtc,
            defaultAddress?.ToDto(),
            c.PreferredSize,
            c.MarketingOptIn,
            c.Role.ToString().ToLowerInvariant());
    }

    public static OrderDto ToDto(this Order o)
    {
        var a = o.ShippingAddress;
        return new OrderDto(
            o.Id,
            o.OrderNumber,
            o.CustomerId,
            o.Email,
            o.PlacedUtc,
            o.Status.ToApi(),
            o.PaymentStatus.ToApi(),
            o.PaymentStatus == PaymentStatus.Simulated ? "demo" : o.PaymentProvider.ToLowerInvariant(),
            o.Items.OrderBy(i => i.Id).Select(i => new OrderLineDto(
                i.Sku, i.ProductCode, i.ProductSlug, i.ProductName, i.BrandName, i.ColourCode, i.ColourName,
                i.Size, i.ImageUrl, i.UnitPrice, i.Quantity, i.LineTotal)).ToList(),
            new OrderAddressDto(a.FirstName, a.LastName, a.Line1, a.Line2, a.City, a.District, a.PostalCode, a.Phone),
            o.ShippingMethodCode,
            o.ShippingMethodName,
            new DeliveryEstimateDto(o.EstimatedDeliveryFromUtc, o.EstimatedDeliveryToUtc),
            o.Subtotal,
            o.DiscountTotal,
            o.CouponCode,
            o.ShippingTotal,
            o.GrandTotal,
            o.Currency,
            o.StatusHistory.OrderBy(h => h.CreatedUtc)
                .Select(h => new OrderStatusEntryDto(h.Status.ToApi(), h.Note, h.CreatedUtc)).ToList(),
            o.PaymentProvider,
            OrderWorkflow.CanTakePayment(o.Status) && o.PaymentStatus is PaymentStatus.Pending or PaymentStatus.Failed ? o.PaymentExpiresUtc : null);
    }
}
