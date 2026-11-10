using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services.Admin;

public interface IStockReceiptService
{
    Task<StockReceiptDto> ReceiveAsync(CreateStockReceiptRequest request, CancellationToken ct);
    Task<PagedResult<StockReceiptSummaryDto>> ListAsync(StockReceiptQuery query, CancellationToken ct);
    Task<StockReceiptDto> GetAsync(int id, CancellationToken ct);
}

/// <summary>
/// Records deliveries from suppliers. In one database transaction it creates the receipt, adds each
/// quantity to the matching variant (creating the variant if that size is new for the colour), writes an
/// inventory transaction per line and, if given, updates the product's selling price.
/// </summary>
public sealed class StockReceiptService(
    IAppDbContext db,
    IAdminContext admin,
    IInventoryLedger ledger,
    IClock clock,
    ILogger<StockReceiptService> logger) : IStockReceiptService
{
    public const int MaxQuantityPerLine = 10_000;

    public async Task<StockReceiptDto> ReceiveAsync(CreateStockReceiptRequest r, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);

        // A repeated submission (double-click, retry after a timeout) returns the receipt already recorded.
        var duplicate = await db.StockReceipts.AsNoTracking().Include(x => x.Items)
            .FirstOrDefaultAsync(x => x.ClientRequestId == r.ClientRequestId, ct);
        if (duplicate is not null) return duplicate.ToDto();

        var lines = r.Lines.Where(l => l.Quantity != 0).ToList();
        if (lines.Count == 0) throw new BusinessRuleException("Enter a received quantity for at least one size.", "no_quantities");
        if (lines.Any(l => l.Quantity < 0 || l.Quantity > MaxQuantityPerLine))
            throw new BusinessRuleException($"Quantities must be between 1 and {MaxQuantityPerLine:N0}.", "invalid_quantity");
        if (lines.GroupBy(l => (l.ColourId, Size: l.Size.Trim().ToUpperInvariant())).Any(g => g.Count() > 1))
            throw new BusinessRuleException("Each colour and size can only appear once in a receipt.", "duplicate_line");

        var product = await db.Products
            .Include(p => p.Colours)
            .Include(p => p.Variants).ThenInclude(v => v.Size)
            .FirstOrDefaultAsync(p => p.Id == r.ProductId, ct)
            ?? throw new NotFoundException("That product doesn't exist. It may have been deleted.", "product_not_found");

        // Supplier: existing id, or find/create by name.
        Supplier? supplier = null;
        if (r.SupplierId is { } supplierId)
        {
            supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == supplierId, ct)
                       ?? throw new BusinessRuleException("That supplier no longer exists.", "supplier_not_found");
        }
        else if (AdminMapping.NullIfEmpty(r.SupplierName) is { } supplierName)
        {
            supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Name == supplierName, ct);
            if (supplier is null)
            {
                supplier = new Supplier { Name = supplierName };
                db.Suppliers.Add(supplier);
            }
        }

        var reference = AdminMapping.NullIfEmpty(r.SupplierReference);
        if (supplier is { Id: > 0 } && reference is not null &&
            await db.StockReceipts.AnyAsync(x => x.SupplierId == supplier.Id && x.SupplierReference == reference, ct))
            throw new ConflictException($"Invoice {reference} from {supplier.Name} has already been recorded. Check Stock history before receiving it again.", "duplicate_invoice");

        var today = clock.UtcNow.Date;
        var receivedDate = DateTime.SpecifyKind(r.ReceivedDate.Date, DateTimeKind.Utc);
        if (receivedDate > today.AddDays(1))
            throw new BusinessRuleException("The received date can't be in the future.", "invalid_date");

        if (r.SellingPrice is { } price)
        {
            if (price <= 0) throw new BusinessRuleException("The selling price must be more than zero.", "invalid_price");
            if (product.OriginalPrice is { } regular && regular > product.Price)
            {
                // Product is on sale: the new price becomes the regular price; keep the sale only if it's still lower.
                if (product.Price < price) product.OriginalPrice = price;
                else { product.Price = price; product.OriginalPrice = null; }
            }
            else
            {
                product.Price = price;
            }
        }

        // Resolve each line to a variant, creating new size variants for existing colours when needed.
        var sizes = await db.Sizes.Where(s => s.SizeSystem == product.SizeSystem).ToDictionaryAsync(s => s.Code, StringComparer.OrdinalIgnoreCase, ct);
        var resolved = new List<(ProductVariant Variant, int Quantity)>();
        foreach (var line in lines)
        {
            var colour = product.Colours.FirstOrDefault(c => c.Id == line.ColourId)
                         ?? throw new BusinessRuleException("One of the colours isn't part of this product. Refresh and try again.", "invalid_colour");
            if (!sizes.TryGetValue(line.Size.Trim(), out var size))
                throw new BusinessRuleException($"UK {line.Size} isn't a valid size for {product.Name}.", "invalid_size");

            var variant = product.Variants.FirstOrDefault(v => v.ProductColourId == colour.Id && v.SizeId == size.Id);
            if (variant is null)
            {
                variant = new ProductVariant
                {
                    Product = product,
                    ProductColourId = colour.Id,
                    Colour = colour,
                    SizeId = size.Id,
                    Size = size,
                    Sku = $"{product.Code}-{colour.Code.ToUpperInvariant()}-{size.Code}",
                    StockQuantity = 0,
                };
                product.Variants.Add(variant);
            }
            resolved.Add((variant, line.Quantity));
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        var receipt = new StockReceipt
        {
            ReceiptNumber = await NextReceiptNumberAsync(receivedDate, ct),
            ClientRequestId = r.ClientRequestId,
            Supplier = supplier,
            SupplierName = supplier?.Name,
            SupplierReference = reference,
            ReceivedDate = receivedDate,
            ProductId = product.Id,
            ProductCode = product.Code,
            ProductName = product.Name,
            UnitCost = r.UnitCost,
            SellingPrice = product.Price,
            Notes = AdminMapping.NullIfEmpty(r.Notes),
            TotalQuantity = resolved.Sum(x => x.Quantity),
            ReceivedById = actor.Id,
            ReceivedByName = actor.Name,
            CreatedUtc = clock.UtcNow,
        };
        db.StockReceipts.Add(receipt);
        product.ModifiedUtc = clock.UtcNow;

        // Save the receipt, any new variants, supplier and price changes first so ids exist for the ledger.
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // The same submission may have been recorded a moment ago by a parallel request: return that receipt.
            await tx.RollbackAsync(ct);
            if (!await IsDuplicateAsync(r.ClientRequestId, ct)) throw;
            var existing = await db.StockReceipts.AsNoTracking().Include(x => x.Items).FirstAsync(x => x.ClientRequestId == r.ClientRequestId, ct);
            return existing.ToDto();
        }

        foreach (var (variant, quantity) in resolved)
        {
            // Receiving adds to the existing quantity; it never overwrites it.
            var movement = await ledger.TryApplyAsync(
                variant.Id, quantity, InventoryTransactionType.Received,
                supplier is null ? "Stock received" : $"Stock received from {supplier.Name}",
                receipt.ReceiptNumber, actor, ct, receipt.Id)
                ?? throw new InvalidOperationException("Adding stock can't make it negative.");

            receipt.Items.Add(new StockReceiptItem
            {
                ProductVariantId = variant.Id,
                Sku = variant.Sku,
                ColourName = variant.Colour.Name,
                Size = variant.Size.Code,
                Quantity = quantity,
                PreviousQuantity = movement.PreviousQuantity,
                NewQuantity = movement.NewQuantity,
            });
        }

        admin.Audit(actor, "stock.received", "receipt", receipt.Id.ToString(CultureInfo.InvariantCulture),
            $"{receipt.ReceiptNumber}: {receipt.TotalQuantity} pairs of {product.Code} {product.Name}");
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return Logged(receipt, actor, product);
    }

    private StockReceiptDto Logged(StockReceipt receipt, Actor actor, Product product)
    {
        logger.LogInformation("Stock receipt {Receipt} recorded by {Actor}: {Quantity} pairs of {Code}",
            receipt.ReceiptNumber, actor.Name, receipt.TotalQuantity, product.Code);
        return receipt.ToDto();
    }

    private async Task<bool> IsDuplicateAsync(Guid clientRequestId, CancellationToken ct)
    {
        // Wait for the parallel request's transaction to finish, then look for its receipt.
        for (var attempt = 0; attempt < 10; attempt++)
        {
            if (await db.StockReceipts.AsNoTracking().AnyAsync(x => x.ClientRequestId == clientRequestId, ct)) return true;
            await Task.Delay(200, ct);
        }
        return false;
    }

    public async Task<PagedResult<StockReceiptSummaryDto>> ListAsync(StockReceiptQuery q, CancellationToken ct)
    {
        var (page, pageSize) = AdminMapping.Paging(q.Page, q.PageSize);
        var query = db.StockReceipts.AsNoTracking().AsQueryable();
        if (AdminMapping.NullIfEmpty(q.Search) is { } search)
            query = query.Where(x => x.ReceiptNumber.Contains(search) || x.ProductName.Contains(search) || x.ProductCode.Contains(search) ||
                                     (x.SupplierName != null && x.SupplierName.Contains(search)) ||
                                     (x.SupplierReference != null && x.SupplierReference.Contains(search)));
        if (q.SupplierId is { } supplierId) query = query.Where(x => x.SupplierId == supplierId);
        if (q.ProductId is { } productId) query = query.Where(x => x.ProductId == productId);
        if (q.From is { } from) query = query.Where(x => x.ReceivedDate >= from.Date);
        if (q.To is { } to) query = query.Where(x => x.ReceivedDate <= to.Date);

        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(x => x.CreatedUtc)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .ToListAsync(ct);
        return PagedResult<StockReceiptSummaryDto>.Create(rows.Select(x => x.ToSummaryDto()).ToList(), page, pageSize, total);
    }

    public async Task<StockReceiptDto> GetAsync(int id, CancellationToken ct)
    {
        var receipt = await db.StockReceipts.AsNoTracking().Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id, ct)
                      ?? throw new NotFoundException("That stock receipt doesn't exist.", "receipt_not_found");
        return receipt.ToDto();
    }

    private async Task<string> NextReceiptNumberAsync(DateTime date, CancellationToken ct)
    {
        var prefix = $"GRN-{date:yyMM}-";
        var last = await db.StockReceipts.AsNoTracking()
            .Where(x => x.ReceiptNumber.StartsWith(prefix))
            .OrderByDescending(x => x.ReceiptNumber)
            .Select(x => x.ReceiptNumber)
            .FirstOrDefaultAsync(ct);
        var next = last is not null && int.TryParse(last[prefix.Length..], NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n + 1 : 1;
        return $"{prefix}{next:0000}";
    }
}
