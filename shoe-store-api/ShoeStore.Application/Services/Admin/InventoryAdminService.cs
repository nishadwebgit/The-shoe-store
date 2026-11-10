using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Options;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services.Admin;

public interface IInventoryAdminService
{
    Task<PagedResult<InventoryItemDto>> ListAsync(InventoryQuery query, CancellationToken ct);
    Task<StockAdjustmentResultDto> AdjustAsync(int variantId, AdjustStockRequest request, CancellationToken ct);
    Task<InventoryItemDto> SetThresholdAsync(int variantId, SetThresholdRequest request, CancellationToken ct);
    Task<PagedResult<InventoryTransactionDto>> TransactionsAsync(TransactionQuery query, CancellationToken ct);
    Task<IReadOnlyList<InventoryItemDto>> LowStockAsync(int limit, CancellationToken ct);

    Task<IReadOnlyList<SupplierDto>> SuppliersAsync(CancellationToken ct);
    Task<SupplierDto> SaveSupplierAsync(int? id, SupplierRequest request, CancellationToken ct);

    Task<StoreSettingsDto> GetSettingsAsync(CancellationToken ct);
    Task<StoreSettingsDto> UpdateSettingsAsync(UpdateStoreSettingsRequest request, CancellationToken ct);
}

/// <summary>Inventory views, audited manual adjustments, low-stock thresholds, suppliers and store settings.</summary>
public sealed class InventoryAdminService(
    IAppDbContext db,
    IAdminContext admin,
    IInventoryLedger ledger,
    IClock clock,
    IOptions<AdminOptions> adminOptions,
    ILogger<InventoryAdminService> logger) : IInventoryAdminService
{
    // ------------------------------------------------------------------ Inventory list

    public async Task<PagedResult<InventoryItemDto>> ListAsync(InventoryQuery q, CancellationToken ct)
    {
        var (page, pageSize) = AdminMapping.Paging(q.Page, q.PageSize, 200);
        var threshold = (await admin.GetSettingsAsync(ct)).LowStockThreshold;
        var query = db.ProductVariants.AsNoTracking().AsQueryable();

        if (AdminMapping.NullIfEmpty(q.Search) is { } search)
            query = query.Where(v => v.Sku.Contains(search) || v.Product.Name.Contains(search) || v.Product.Code.Contains(search) ||
                                     v.Product.Brand.Name.Contains(search) || v.Colour.Name.Contains(search));
        if (q.BrandId is { } brandId) query = query.Where(v => v.Product.BrandId == brandId);
        if (q.ProductId is { } productId) query = query.Where(v => v.ProductId == productId);
        if (AdminMapping.NullIfEmpty(q.Category) is { } category)
            query = query.Where(v => v.Product.ProductCategories.Any(pc => pc.Category.Code == category));
        if (AdminMapping.NullIfEmpty(q.Size) is { } size) query = query.Where(v => v.Size.Code == size);
        query = q.Stock?.Trim().ToLowerInvariant() switch
        {
            StockState.Out => query.Where(v => v.StockQuantity <= 0),
            StockState.Low => query.Where(v => v.StockQuantity > 0 && v.StockQuantity <= (v.LowStockThreshold ?? threshold)),
            StockState.In => query.Where(v => v.StockQuantity > 0),
            _ => query,
        };
        query = q.Sort?.Trim().ToLowerInvariant() switch
        {
            "stock-asc" => query.OrderBy(v => v.StockQuantity).ThenBy(v => v.Product.Name),
            "stock-desc" => query.OrderByDescending(v => v.StockQuantity).ThenBy(v => v.Product.Name),
            "updated" => query.OrderByDescending(v => v.ModifiedUtc ?? v.CreatedUtc),
            _ => query.OrderBy(v => v.Product.Name).ThenBy(v => v.Colour.SortOrder).ThenBy(v => v.Size.SortOrder),
        };

        var total = await query.CountAsync(ct);
        var ids = await query.Skip((page - 1) * pageSize).Take(pageSize).Select(v => v.Id).ToListAsync(ct);
        var items = await LoadItemsAsync(ids, threshold, ct);
        return PagedResult<InventoryItemDto>.Create(items, page, pageSize, total);
    }

    public async Task<IReadOnlyList<InventoryItemDto>> LowStockAsync(int limit, CancellationToken ct)
    {
        var threshold = (await admin.GetSettingsAsync(ct)).LowStockThreshold;
        var ids = await db.ProductVariants.AsNoTracking()
            .Where(v => v.Product.IsActive && v.StockQuantity <= (v.LowStockThreshold ?? threshold))
            .OrderBy(v => v.StockQuantity).ThenBy(v => v.Product.Name)
            .Take(Math.Clamp(limit, 1, 50))
            .Select(v => v.Id)
            .ToListAsync(ct);
        return await LoadItemsAsync(ids, threshold, ct);
    }

    /// <summary>Loads inventory rows for the given variant ids, preserving their order.</summary>
    private async Task<List<InventoryItemDto>> LoadItemsAsync(List<int> ids, int threshold, CancellationToken ct)
    {
        if (ids.Count == 0) return [];
        var rows = await db.ProductVariants.AsNoTracking()
            .Where(v => ids.Contains(v.Id))
            .Select(v => new
            {
                v.Id,
                v.Sku,
                v.ProductId,
                ProductCode = v.Product.Code,
                ProductName = v.Product.Name,
                Brand = v.Product.Brand.Name,
                Colour = v.Colour.Name,
                Swatch = v.Colour.SwatchHex,
                Size = v.Size.Code,
                v.StockQuantity,
                v.LowStockThreshold,
                ProductActive = v.Product.IsActive,
                Image = v.Colour.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault(),
                Updated = v.ModifiedUtc ?? v.CreatedUtc,
            })
            .ToListAsync(ct);

        // "Held": pairs reserved by card orders still waiting for payment. They are already deducted from stock.
        var held = await db.OrderItems.AsNoTracking()
            .Where(i => i.ProductVariantId != null && ids.Contains(i.ProductVariantId!.Value) &&
                        (i.Order.PaymentStatus == PaymentStatus.Pending || i.Order.PaymentStatus == PaymentStatus.Failed) &&
                        (i.Order.Status == OrderStatus.Pending || i.Order.Status == OrderStatus.Confirmed || i.Order.Status == OrderStatus.Processing))
            .GroupBy(i => i.ProductVariantId!.Value)
            .Select(g => new { VariantId = g.Key, Quantity = g.Sum(i => i.Quantity) })
            .ToDictionaryAsync(x => x.VariantId, x => x.Quantity, ct);

        return ids.Select(id => rows.First(r => r.Id == id)).Select(r =>
        {
            var effective = r.LowStockThreshold ?? threshold;
            return new InventoryItemDto(r.Id, r.Sku, r.ProductId, r.ProductCode, r.ProductName, r.Brand, r.Colour, r.Swatch, r.Size,
                r.StockQuantity, held.GetValueOrDefault(r.Id), r.LowStockThreshold, effective, StockState.Of(r.StockQuantity, effective),
                r.ProductActive, r.Image, r.Updated);
        }).ToList();
    }

    // ------------------------------------------------------------------ Adjustments

    public async Task<StockAdjustmentResultDto> AdjustAsync(int variantId, AdjustStockRequest r, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);
        var type = r.Type.Trim().ToLowerInvariant() switch
        {
            "correction" => InventoryTransactionType.Correction,
            "damaged" => InventoryTransactionType.Damaged,
            "lost" => InventoryTransactionType.Lost,
            "returned" => InventoryTransactionType.Returned,
            _ => throw new BusinessRuleException("Choose what kind of adjustment this is.", "invalid_adjustment_type"),
        };
        if (r.Change == 0) throw new BusinessRuleException("Enter how many pairs to add or remove.", "invalid_change");
        if (type is InventoryTransactionType.Damaged or InventoryTransactionType.Lost && r.Change > 0)
            throw new BusinessRuleException("Damaged or lost stock must reduce the quantity.", "invalid_change");
        if (type is InventoryTransactionType.Returned && r.Change < 0)
            throw new BusinessRuleException("Returned stock must increase the quantity.", "invalid_change");
        var reason = r.Reason.Trim();
        if (reason.Length < 3) throw new BusinessRuleException("Give a reason for this adjustment.", "reason_required");

        if (!await db.ProductVariants.AnyAsync(v => v.Id == variantId, ct))
            throw new NotFoundException("That size no longer exists.", "variant_not_found");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var movement = await ledger.TryApplyAsync(variantId, r.Change, type, reason, null, actor, ct);
        if (movement is null)
        {
            var current = await db.ProductVariants.AsNoTracking().Where(v => v.Id == variantId).Select(v => v.StockQuantity).FirstAsync(ct);
            await tx.RollbackAsync(ct);
            throw new ConflictException($"Only {current} in stock, so you can't remove {-r.Change}. Stock can't go below zero.", "stock_negative");
        }
        admin.Audit(actor, "inventory.adjusted", "variant", variantId.ToString(CultureInfo.InvariantCulture),
            $"{movement.Transaction.Sku}: {type} {r.Change:+#;-#} ({movement.PreviousQuantity} → {movement.NewQuantity}). {reason}");
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        logger.LogInformation("Stock adjusted on {Sku} by {Actor}: {Type} {Change}", movement.Transaction.Sku, actor.Name, type, r.Change);
        var threshold = (await admin.GetSettingsAsync(ct)).LowStockThreshold;
        var item = (await LoadItemsAsync([variantId], threshold, ct))[0];
        return new StockAdjustmentResultDto(item, movement.Transaction.ToDto());
    }

    public async Task<InventoryItemDto> SetThresholdAsync(int variantId, SetThresholdRequest r, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);
        if (r.Threshold is < 0 or > 1000) throw new BusinessRuleException("The threshold must be between 0 and 1,000.", "invalid_threshold");
        var sku = await db.ProductVariants.AsNoTracking().Where(v => v.Id == variantId).Select(v => v.Sku).FirstOrDefaultAsync(ct)
                  ?? throw new NotFoundException("That size no longer exists.", "variant_not_found");
        // Only the threshold changes, so the stock quantity (and its rowversion check) is untouched.
        await db.ProductVariants.Where(v => v.Id == variantId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.LowStockThreshold, r.Threshold), ct);
        admin.Audit(actor, "inventory.threshold", "variant", variantId.ToString(CultureInfo.InvariantCulture),
            $"{sku}: low-stock threshold {(r.Threshold is null ? "reset to store default" : $"set to {r.Threshold}")}");
        await db.SaveChangesAsync(ct);
        var threshold = (await admin.GetSettingsAsync(ct)).LowStockThreshold;
        return (await LoadItemsAsync([variantId], threshold, ct))[0];
    }

    // ------------------------------------------------------------------ Transactions

    public async Task<PagedResult<InventoryTransactionDto>> TransactionsAsync(TransactionQuery q, CancellationToken ct)
    {
        var (page, pageSize) = AdminMapping.Paging(q.Page, q.PageSize, 200);
        var query = db.InventoryTransactions.AsNoTracking().AsQueryable();
        if (AdminMapping.NullIfEmpty(q.Search) is { } search)
            query = query.Where(t => t.Sku.Contains(search) || t.ProductName.Contains(search) || t.ProductCode.Contains(search) ||
                                     (t.Reference != null && t.Reference.Contains(search)) || t.Reason.Contains(search) ||
                                     t.PerformedByName.Contains(search));
        var types = ApiValues.SplitList(q.Type).Select(ApiValues.ParseTransactionType).Where(t => t is not null).Select(t => t!.Value).ToList();
        if (types.Count > 0) query = query.Where(t => types.Contains(t.Type));
        if (q.VariantId is { } variantId) query = query.Where(t => t.ProductVariantId == variantId);
        if (q.ProductId is { } productId)
        {
            var code = await db.Products.AsNoTracking().Where(p => p.Id == productId).Select(p => p.Code).FirstOrDefaultAsync(ct);
            query = query.Where(t => t.ProductCode == code);
        }
        if (q.From is { } from) query = query.Where(t => t.CreatedUtc >= from.Date);
        if (q.To is { } to) query = query.Where(t => t.CreatedUtc < to.Date.AddDays(1));

        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(t => t.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return PagedResult<InventoryTransactionDto>.Create(rows.Select(t => t.ToDto()).ToList(), page, pageSize, total);
    }

    // ------------------------------------------------------------------ Suppliers

    public async Task<IReadOnlyList<SupplierDto>> SuppliersAsync(CancellationToken ct) =>
        await db.Suppliers.AsNoTracking()
            .OrderByDescending(s => s.IsActive).ThenBy(s => s.Name)
            .Select(s => new SupplierDto(
                s.Id, s.Name, s.ContactName, s.Phone, s.Email, s.Notes, s.IsActive,
                db.StockReceipts.Count(r => r.SupplierId == s.Id),
                db.StockReceipts.Where(r => r.SupplierId == s.Id).Max(r => (DateTime?)r.CreatedUtc)))
            .ToListAsync(ct);

    public async Task<SupplierDto> SaveSupplierAsync(int? id, SupplierRequest r, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);
        var name = r.Name.Trim();
        if (await db.Suppliers.AnyAsync(s => s.Name == name && s.Id != (id ?? 0), ct))
            throw new ConflictException($"A supplier called {name} already exists.", "duplicate_supplier");

        Supplier supplier;
        if (id is { } existingId)
        {
            supplier = await db.Suppliers.FirstOrDefaultAsync(s => s.Id == existingId, ct)
                       ?? throw new NotFoundException("That supplier doesn't exist.", "supplier_not_found");
        }
        else
        {
            supplier = new Supplier();
            db.Suppliers.Add(supplier);
        }
        supplier.Name = name;
        supplier.ContactName = AdminMapping.NullIfEmpty(r.ContactName);
        supplier.Phone = AdminMapping.NullIfEmpty(r.Phone);
        supplier.Email = AdminMapping.NullIfEmpty(r.Email);
        supplier.Notes = AdminMapping.NullIfEmpty(r.Notes);
        supplier.IsActive = r.IsActive;
        await db.SaveChangesAsync(ct);
        admin.Audit(actor, id is null ? "supplier.created" : "supplier.updated", "supplier", supplier.Id.ToString(CultureInfo.InvariantCulture), supplier.Name);
        await db.SaveChangesAsync(ct);
        return (await SuppliersAsync(ct)).First(s => s.Id == supplier.Id);
    }

    // ------------------------------------------------------------------ Settings

    public async Task<StoreSettingsDto> GetSettingsAsync(CancellationToken ct)
    {
        var settings = await admin.GetSettingsAsync(ct);
        var emails = adminOptions.Value.OwnerEmails.Select(e => e.Trim().ToUpperInvariant()).Where(e => e.Length > 0).Distinct().ToList();
        var accounts = await db.Customers.AsNoTracking()
            .Where(c => emails.Contains(c.NormalizedEmail))
            .Select(c => new { c.NormalizedEmail, c.Email, c.FirstName, c.LastName, c.LastLoginUtc })
            .ToListAsync(ct);
        var owners = adminOptions.Value.OwnerEmails.Select(e => e.Trim()).Where(e => e.Length > 0).Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(e =>
            {
                var account = accounts.FirstOrDefault(a => a.NormalizedEmail == e.ToUpperInvariant());
                return new OwnerAccountDto(account?.Email ?? e, account is null ? null : $"{account.FirstName} {account.LastName}".Trim(),
                    account is not null, account?.LastLoginUtc);
            })
            .ToList();
        return new StoreSettingsDto(settings.LowStockThreshold, settings.ModifiedUtc, settings.ModifiedByName, owners);
    }

    public async Task<StoreSettingsDto> UpdateSettingsAsync(UpdateStoreSettingsRequest r, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);
        if (r.LowStockThreshold is < 0 or > 1000) throw new BusinessRuleException("The threshold must be between 0 and 1,000.", "invalid_threshold");
        var settings = await admin.GetSettingsAsync(ct);
        if (settings.LowStockThreshold != r.LowStockThreshold)
        {
            admin.Audit(actor, "settings.updated", "settings", "1", $"Low-stock threshold {settings.LowStockThreshold} → {r.LowStockThreshold}");
            settings.LowStockThreshold = r.LowStockThreshold;
            settings.ModifiedUtc = clock.UtcNow;
            settings.ModifiedByName = actor.Name;
            await db.SaveChangesAsync(ct);
        }
        return await GetSettingsAsync(ct);
    }
}
