using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ShoeStore.Api.Infrastructure;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Services.Admin;

namespace ShoeStore.Api.Controllers;

// Owner Portal API. Every endpoint requires an owner account: the Admin role in the access token and,
// checked on each request, in the database (see AdminPolicy). Customers get 403, anonymous callers 401.

/// <summary>Owner Portal: dashboard and lookups.</summary>
[ApiController]
[Route("api/v1/admin")]
[Authorize(Policy = AdminPolicy.Name)]
[Tags("Owner portal")]
[Produces("application/json")]
public sealed class AdminDashboardController(IAdminOrderService orders, IAdminProductService products) : ControllerBase
{
    /// <summary>Store overview: product, stock and order figures, 14-day sales, low stock and recent activity.</summary>
    [HttpGet("dashboard")]
    public async Task<ActionResult<AdminDashboardDto>> Dashboard(CancellationToken ct) => Ok(await orders.DashboardAsync(ct));

    /// <summary>Brands, categories, sizes, colour families, suppliers and product types for forms.</summary>
    [HttpGet("lookups")]
    public async Task<ActionResult<AdminLookupsDto>> Lookups(CancellationToken ct) => Ok(await products.GetLookupsAsync(ct));
}

/// <summary>Owner Portal: product catalogue management.</summary>
[ApiController]
[Route("api/v1/admin/products")]
[Authorize(Policy = AdminPolicy.Name)]
[Tags("Owner portal")]
[Produces("application/json")]
public sealed class AdminProductsController(IAdminProductService products) : ControllerBase
{
    /// <summary>Search and filter products (including inactive ones).</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminProductListItemDto>>> List([FromQuery] AdminProductQuery query, CancellationToken ct) =>
        Ok(await products.ListAsync(query, ct));

    /// <summary>Full product details with colours, images, sizes, stock and audit information.</summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType<AdminProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<AdminProductDto>> Get(int id, CancellationToken ct) => Ok(await products.GetAsync(id, ct));

    /// <summary>Create a product. Sizes become variants with zero stock; receive stock to make them sellable.</summary>
    [HttpPost]
    [ProducesResponseType<AdminProductDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AdminProductDto>> Create(AdminProductRequest request, CancellationToken ct)
    {
        var product = await products.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = product.Id }, product);
    }

    /// <summary>Update a product's details, colours, images and sizes. Stock is not changed here.</summary>
    [HttpPut("{id:int}")]
    public async Task<ActionResult<AdminProductDto>> Update(int id, AdminProductRequest request, CancellationToken ct) =>
        Ok(await products.UpdateAsync(id, request, ct));

    /// <summary>Activate/deactivate or feature/unfeature a product.</summary>
    [HttpPatch("{id:int}/status")]
    public async Task<ActionResult<AdminProductDto>> SetStatus(int id, AdminProductStatusRequest request, CancellationToken ct) =>
        Ok(await products.SetStatusAsync(id, request, ct));

    /// <summary>Add a colourway (used while receiving stock of a new colour).</summary>
    [HttpPost("{id:int}/colours")]
    public async Task<ActionResult<AdminProductDto>> AddColour(int id, AddColourRequest request, CancellationToken ct) =>
        Ok(await products.AddColourAsync(id, request, ct));

    /// <summary>Delete a product that has no stock and has never been ordered. Otherwise deactivate it.</summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await products.DeleteAsync(id, ct);
        return NoContent();
    }
}

/// <summary>Owner Portal: image uploads.</summary>
[ApiController]
[Route("api/v1/admin/media")]
[Authorize(Policy = AdminPolicy.Name)]
[Tags("Owner portal")]
[Produces("application/json")]
public sealed class AdminMediaController(IMediaService media) : ControllerBase
{
    /// <summary>Upload one product image (JPG, PNG or WebP, up to 5 MB). Returns its URL to use in a product.</summary>
    [HttpPost("images")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    [ProducesResponseType<MediaUploadResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<MediaUploadResultDto>> UploadImage(IFormFile file, CancellationToken ct)
    {
        await using var stream = file.OpenReadStream();
        return Ok(await media.UploadImageAsync(stream, file.FileName, file.Length, ct));
    }
}

/// <summary>Owner Portal: receiving stock from suppliers.</summary>
[ApiController]
[Route("api/v1/admin/stock-receipts")]
[Authorize(Policy = AdminPolicy.Name)]
[Tags("Owner portal")]
[Produces("application/json")]
public sealed class AdminStockReceiptsController(IStockReceiptService receipts) : ControllerBase
{
    /// <summary>Record a delivery: adds each quantity to the matching size and colour and writes the stock history.</summary>
    /// <remarks>Send a new clientRequestId per submission; repeating the same id returns the existing receipt instead of adding stock twice.</remarks>
    [HttpPost]
    [ProducesResponseType<StockReceiptDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<StockReceiptDto>> Receive(CreateStockReceiptRequest request, CancellationToken ct) =>
        Ok(await receipts.ReceiveAsync(request, ct));

    /// <summary>Stock receiving history.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<StockReceiptSummaryDto>>> List([FromQuery] StockReceiptQuery query, CancellationToken ct) =>
        Ok(await receipts.ListAsync(query, ct));

    /// <summary>One stock receipt with its lines.</summary>
    [HttpGet("{id:int}")]
    public async Task<ActionResult<StockReceiptDto>> Get(int id, CancellationToken ct) => Ok(await receipts.GetAsync(id, ct));
}

/// <summary>Owner Portal: inventory, adjustments and stock history.</summary>
[ApiController]
[Route("api/v1/admin/inventory")]
[Authorize(Policy = AdminPolicy.Name)]
[Tags("Owner portal")]
[Produces("application/json")]
public sealed class AdminInventoryController(IInventoryAdminService inventory) : ControllerBase
{
    /// <summary>Stock for every product, colour and size.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<InventoryItemDto>>> List([FromQuery] InventoryQuery query, CancellationToken ct) =>
        Ok(await inventory.ListAsync(query, ct));

    /// <summary>Adjust stock (correction, damaged, lost, returned). A reason is required; stock can't go below zero.</summary>
    [HttpPost("{variantId:int}/adjustments")]
    [ProducesResponseType<StockAdjustmentResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<StockAdjustmentResultDto>> Adjust(int variantId, AdjustStockRequest request, CancellationToken ct) =>
        Ok(await inventory.AdjustAsync(variantId, request, ct));

    /// <summary>Set (or clear, with null) this size's own low-stock threshold.</summary>
    [HttpPut("{variantId:int}/threshold")]
    public async Task<ActionResult<InventoryItemDto>> SetThreshold(int variantId, SetThresholdRequest request, CancellationToken ct) =>
        Ok(await inventory.SetThresholdAsync(variantId, request, ct));

    /// <summary>Every stock movement: receipts, sales, releases and manual adjustments.</summary>
    [HttpGet("transactions")]
    public async Task<ActionResult<PagedResult<InventoryTransactionDto>>> Transactions([FromQuery] TransactionQuery query, CancellationToken ct) =>
        Ok(await inventory.TransactionsAsync(query, ct));
}

/// <summary>Owner Portal: suppliers and store settings.</summary>
[ApiController]
[Route("api/v1/admin")]
[Authorize(Policy = AdminPolicy.Name)]
[Tags("Owner portal")]
[Produces("application/json")]
public sealed class AdminSettingsController(IInventoryAdminService inventory) : ControllerBase
{
    [HttpGet("suppliers")]
    public async Task<ActionResult<IReadOnlyList<SupplierDto>>> Suppliers(CancellationToken ct) => Ok(await inventory.SuppliersAsync(ct));

    [HttpPost("suppliers")]
    public async Task<ActionResult<SupplierDto>> CreateSupplier(SupplierRequest request, CancellationToken ct) =>
        Ok(await inventory.SaveSupplierAsync(null, request, ct));

    [HttpPut("suppliers/{id:int}")]
    public async Task<ActionResult<SupplierDto>> UpdateSupplier(int id, SupplierRequest request, CancellationToken ct) =>
        Ok(await inventory.SaveSupplierAsync(id, request, ct));

    /// <summary>Store settings and the configured owner accounts.</summary>
    [HttpGet("settings")]
    public async Task<ActionResult<StoreSettingsDto>> Settings(CancellationToken ct) => Ok(await inventory.GetSettingsAsync(ct));

    [HttpPut("settings")]
    public async Task<ActionResult<StoreSettingsDto>> UpdateSettings(UpdateStoreSettingsRequest request, CancellationToken ct) =>
        Ok(await inventory.UpdateSettingsAsync(request, ct));
}

/// <summary>Owner Portal: customer orders and customers.</summary>
[ApiController]
[Route("api/v1/admin")]
[Authorize(Policy = AdminPolicy.Name)]
[Tags("Owner portal")]
[Produces("application/json")]
public sealed class AdminOrdersController(IAdminOrderService orders) : ControllerBase
{
    /// <summary>Orders, newest first. Filter by status (comma-separated), payment status, text or date range.</summary>
    [HttpGet("orders")]
    public async Task<ActionResult<PagedResult<AdminOrderListItemDto>>> List([FromQuery] AdminOrderQuery query, CancellationToken ct) =>
        Ok(await orders.ListAsync(query, ct));

    /// <summary>Number of orders in each status.</summary>
    [HttpGet("orders/counts")]
    public async Task<ActionResult<AdminOrderCountsDto>> Counts(CancellationToken ct) => Ok(await orders.CountsAsync(ct));

    /// <summary>Full order with customer, payment records and status history.</summary>
    [HttpGet("orders/{orderNumber}")]
    public async Task<ActionResult<AdminOrderDto>> Get(string orderNumber, CancellationToken ct) => Ok(await orders.GetAsync(orderNumber, ct));

    /// <summary>Move an order to its next status, or cancel it (a reason is required; reserved stock is returned).</summary>
    /// <remarks>Ready for dispatch, shipped and delivered require a settled payment. Payment status is never changed here.</remarks>
    [HttpPost("orders/{orderNumber}/status")]
    [ProducesResponseType<AdminOrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<AdminOrderDto>> UpdateStatus(string orderNumber, UpdateOrderStatusRequest request, CancellationToken ct) =>
        Ok(await orders.UpdateStatusAsync(orderNumber, request, ct));

    /// <summary>Registered customers with their order totals.</summary>
    [HttpGet("customers")]
    public async Task<ActionResult<PagedResult<AdminCustomerDto>>> Customers([FromQuery] AdminCustomerQuery query, CancellationToken ct) =>
        Ok(await orders.CustomersAsync(query, ct));
}
