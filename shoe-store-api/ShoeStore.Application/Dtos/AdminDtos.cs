namespace ShoeStore.Application.Dtos;

// Owner Portal (admin) contracts. Mirrored by src/admin/types.ts in the React app.

// ------------------------------------------------------------------ Lookups

public sealed record IdNameDto(int Id, string Name);

public sealed record CodeNameDto(string Code, string Name);

public sealed record AdminSizeDto(string Code, string Label, string SizeSystem);

public sealed record ColourFamilyDto(string Value, string Label, string Swatch);

public sealed record AdminLookupsDto(
    IReadOnlyList<IdNameDto> Brands,
    IReadOnlyList<CodeNameDto> Categories,
    IReadOnlyList<AdminSizeDto> Sizes,
    IReadOnlyList<ColourFamilyDto> ColourFamilies,
    IReadOnlyList<IdNameDto> Suppliers,
    IReadOnlyList<string> Silhouettes,
    int LowStockThreshold,
    string NextProductCode);

// ------------------------------------------------------------------ Products

public sealed class AdminProductQuery
{
    /// <summary>Name, product code, SKU, brand or category.</summary>
    public string? Search { get; set; }
    public int? BrandId { get; set; }
    /// <summary>Category code.</summary>
    public string? Category { get; set; }
    /// <summary>active or inactive.</summary>
    public string? Status { get; set; }
    /// <summary>in, low or out.</summary>
    public string? Stock { get; set; }
    /// <summary>updated (default), name, code, price, stock.</summary>
    public string? Sort { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed record AdminProductListItemDto(
    int Id,
    string Code,
    string Slug,
    string Name,
    string Brand,
    IReadOnlyList<string> Categories,
    string Gender,
    decimal Price,
    decimal? OriginalPrice,
    string? Image,
    int TotalStock,
    int VariantCount,
    int LowStockVariants,
    int OutOfStockVariants,
    bool IsActive,
    bool IsFeatured,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

public sealed record AdminImageDto(int Id, string Url, string? AltText, int SortOrder);

public sealed record AdminColourDto(int Id, string Code, string Name, string Swatch, string Family, IReadOnlyList<AdminImageDto> Images);

public sealed record AdminVariantDto(
    int Id,
    string Sku,
    int ColourId,
    string ColourName,
    string Size,
    string SizeLabel,
    int Stock,
    int? LowStockThreshold,
    int EffectiveThreshold,
    string StockState,
    DateTime? UpdatedAt);

public sealed record AdminProductDto(
    int Id,
    string Code,
    string Slug,
    string Name,
    int BrandId,
    string Brand,
    IReadOnlyList<string> Categories,
    string Gender,
    string SizeSystem,
    string Fit,
    string Silhouette,
    string Description,
    string Materials,
    string Care,
    decimal RegularPrice,
    decimal? SalePrice,
    bool IsActive,
    bool IsFeatured,
    bool IsNewArrival,
    IReadOnlyList<string> Highlights,
    IReadOnlyList<AdminColourDto> Colours,
    IReadOnlyList<AdminVariantDto> Variants,
    int TotalStock,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    string? CreatedBy,
    string? UpdatedBy,
    bool CanDelete,
    string? DeleteBlockedReason);

public sealed record AdminImageRequest(string Url, string? AltText);

/// <param name="Id">Existing colour id; null adds a new colourway.</param>
/// <param name="Sizes">Size codes offered in this colour. Each becomes a variant (SKU); stock starts at 0.</param>
/// <param name="Images">Images in display order; the first is the primary image.</param>
public sealed record AdminColourRequest(
    int? Id,
    string Name,
    string Swatch,
    string Family,
    IReadOnlyList<string> Sizes,
    IReadOnlyList<AdminImageRequest> Images);

/// <summary>
/// Creates or updates a product. Stock is never set here: it only changes through stock receipts and
/// audited adjustments. <paramref name="SalePrice"/> (if set) is what customers pay; the regular price is
/// then shown struck through.
/// </summary>
public sealed record AdminProductRequest(
    string Name,
    string? Code,
    int? BrandId,
    string? NewBrandName,
    IReadOnlyList<string> Categories,
    string Gender,
    string SizeSystem,
    string Fit,
    string Silhouette,
    string Description,
    string? Materials,
    string? Care,
    decimal RegularPrice,
    decimal? SalePrice,
    bool IsActive,
    bool IsFeatured,
    bool IsNewArrival,
    IReadOnlyList<string>? Highlights,
    IReadOnlyList<AdminColourRequest> Colours);

public sealed record AdminProductStatusRequest(bool? IsActive, bool? IsFeatured);

public sealed record AddColourRequest(string Name, string Swatch, string Family);

public sealed record MediaUploadResultDto(string Url, string Key, long Size, string ContentType);

// ------------------------------------------------------------------ Stock receipts

public sealed record StockReceiptLineRequest(int ColourId, string Size, int Quantity);

/// <param name="ClientRequestId">New GUID per submission; resubmitting the same id returns the original receipt.</param>
/// <param name="SellingPrice">Optional new regular selling price for the product.</param>
public sealed record CreateStockReceiptRequest(
    Guid ClientRequestId,
    int ProductId,
    int? SupplierId,
    string? SupplierName,
    string? SupplierReference,
    DateTime ReceivedDate,
    decimal? UnitCost,
    decimal? SellingPrice,
    string? Notes,
    IReadOnlyList<StockReceiptLineRequest> Lines);

public sealed record StockReceiptLineDto(string Sku, string Colour, string Size, int Quantity, int PreviousQuantity, int NewQuantity);

public sealed record StockReceiptDto(
    int Id,
    string ReceiptNumber,
    string? Supplier,
    string? SupplierReference,
    DateTime ReceivedDate,
    int? ProductId,
    string ProductCode,
    string ProductName,
    decimal? UnitCost,
    decimal SellingPrice,
    string? Notes,
    int TotalQuantity,
    decimal? TotalCost,
    string ReceivedBy,
    DateTime CreatedAt,
    IReadOnlyList<StockReceiptLineDto> Lines);

public sealed record StockReceiptSummaryDto(
    int Id,
    string ReceiptNumber,
    string? Supplier,
    string? SupplierReference,
    DateTime ReceivedDate,
    int? ProductId,
    string ProductCode,
    string ProductName,
    int TotalQuantity,
    decimal? TotalCost,
    string ReceivedBy,
    DateTime CreatedAt);

public sealed class StockReceiptQuery
{
    public string? Search { get; set; }
    public int? SupplierId { get; set; }
    public int? ProductId { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

// ------------------------------------------------------------------ Inventory

public sealed class InventoryQuery
{
    /// <summary>Product name, code, SKU, brand or colour.</summary>
    public string? Search { get; set; }
    public int? BrandId { get; set; }
    public string? Category { get; set; }
    public int? ProductId { get; set; }
    /// <summary>in, low or out.</summary>
    public string? Stock { get; set; }
    public string? Size { get; set; }
    /// <summary>product (default), stock-asc, stock-desc, updated.</summary>
    public string? Sort { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
}

/// <param name="Held">Pairs reserved by orders still waiting for card payment (already deducted from Available).</param>
public sealed record InventoryItemDto(
    int VariantId,
    string Sku,
    int ProductId,
    string ProductCode,
    string ProductName,
    string Brand,
    string Colour,
    string Swatch,
    string Size,
    int Available,
    int Held,
    int? LowStockThreshold,
    int EffectiveThreshold,
    string StockState,
    bool ProductActive,
    string? Image,
    DateTime? LastUpdated);

/// <param name="Type">correction, damaged, lost or returned.</param>
/// <param name="Change">Signed change: damaged/lost must be negative, returned positive, correction either.</param>
public sealed record AdjustStockRequest(string Type, int Change, string Reason);

public sealed record SetThresholdRequest(int? Threshold);

public sealed class TransactionQuery
{
    public string? Search { get; set; }
    /// <summary>received, sale, released, correction, damaged, lost, returned (comma-separated).</summary>
    public string? Type { get; set; }
    public int? VariantId { get; set; }
    public int? ProductId { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
}

public sealed record InventoryTransactionDto(
    long Id,
    DateTime CreatedAt,
    string Type,
    int? VariantId,
    string Sku,
    string ProductCode,
    string ProductName,
    string Colour,
    string Size,
    int Change,
    int PreviousQuantity,
    int NewQuantity,
    string Reason,
    string? Reference,
    string PerformedBy);

public sealed record StockAdjustmentResultDto(InventoryItemDto Item, InventoryTransactionDto Transaction);

// ------------------------------------------------------------------ Suppliers & settings

public sealed record SupplierDto(
    int Id,
    string Name,
    string? ContactName,
    string? Phone,
    string? Email,
    string? Notes,
    bool IsActive,
    int ReceiptCount,
    DateTime? LastReceiptAt);

public sealed record SupplierRequest(string Name, string? ContactName, string? Phone, string? Email, string? Notes, bool IsActive = true);

public sealed record OwnerAccountDto(string Email, string? Name, bool HasAccount, DateTime? LastLoginAt);

public sealed record StoreSettingsDto(int LowStockThreshold, DateTime? UpdatedAt, string? UpdatedBy, IReadOnlyList<OwnerAccountDto> Owners);

public sealed record UpdateStoreSettingsRequest(int LowStockThreshold);

// ------------------------------------------------------------------ Orders

public sealed class AdminOrderQuery
{
    /// <summary>pending, confirmed, processing, ready-for-dispatch, shipped, delivered, cancelled (comma-separated).</summary>
    public string? Status { get; set; }
    /// <summary>pending, paid, failed, refunded, simulated.</summary>
    public string? Payment { get; set; }
    /// <summary>Order number, customer name, email or phone.</summary>
    public string? Search { get; set; }
    public DateTime? From { get; set; }
    public DateTime? To { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed record AdminOrderListItemDto(
    string OrderNumber,
    string CustomerName,
    string Email,
    bool IsGuest,
    DateTime PlacedAt,
    decimal Total,
    string Currency,
    string Status,
    string PaymentStatus,
    string PaymentMethod,
    int ItemCount,
    IReadOnlyList<string> NextStatuses);

public sealed record AdminOrderCountsDto(IReadOnlyDictionary<string, int> ByStatus, int AwaitingPayment, int Total);

public sealed record AdminOrderCustomerDto(Guid? Id, string Name, string Email, string Phone, bool IsGuest, int OrderCount, DateTime? MemberSince);

public sealed record AdminPaymentTransactionDto(
    DateTime At,
    string Provider,
    string? PaymentId,
    decimal Amount,
    string Currency,
    int StatusCode,
    string Status,
    string? Method,
    bool SignatureValid,
    string? Message);

public sealed record AdminOrderHistoryDto(string Status, string? Note, string By, DateTime At);

/// <param name="PaymentBlockReason">Why the order can't move to dispatch yet (unpaid), if applicable.</param>
public sealed record AdminOrderDto(
    OrderDto Order,
    AdminOrderCustomerDto Customer,
    IReadOnlyList<AdminPaymentTransactionDto> Payments,
    IReadOnlyList<AdminOrderHistoryDto> History,
    IReadOnlyList<string> NextStatuses,
    bool PaymentSettled,
    string? PaymentBlockReason);

public sealed record UpdateOrderStatusRequest(string Status, string? Note);

// ------------------------------------------------------------------ Customers

public sealed class AdminCustomerQuery
{
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed record AdminCustomerDto(
    Guid Id,
    string Name,
    string Email,
    string? Phone,
    DateTime JoinedAt,
    DateTime? LastLoginAt,
    string Role,
    int OrderCount,
    decimal TotalSpent,
    DateTime? LastOrderAt);

// ------------------------------------------------------------------ Dashboard

public sealed record DashboardProductStats(int Total, int Active, int Inactive, int Featured);

public sealed record DashboardStockStats(int TotalUnits, int LowStockVariants, int OutOfStockVariants, int OutOfStockProducts, int ReceivedLast7Days);

public sealed record DashboardOrderStats(int Total, int Pending, int InProgress, int ReadyForDispatch, int Shipped, int Completed, int Cancelled, int AwaitingPayment);

public sealed record DashboardSalesStats(decimal RevenueLast30Days, int OrdersLast30Days, decimal AverageOrderValue, string Currency);

public sealed record DailySalesDto(DateTime Date, int Orders, decimal Revenue);

public sealed record AdminDashboardDto(
    DashboardProductStats Products,
    DashboardStockStats Stock,
    DashboardOrderStats Orders,
    DashboardSalesStats Sales,
    IReadOnlyList<DailySalesDto> Daily,
    IReadOnlyList<InventoryItemDto> LowStock,
    IReadOnlyList<StockReceiptSummaryDto> RecentReceipts,
    IReadOnlyList<InventoryTransactionDto> RecentMovements,
    IReadOnlyList<AdminOrderListItemDto> RecentOrders);
