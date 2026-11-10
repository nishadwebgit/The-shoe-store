using Microsoft.EntityFrameworkCore;
using ShoeStore.Application.Abstractions;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services;

/// <summary>Who caused a stock movement. <see cref="Id"/> is null for automatic movements.</summary>
public sealed record Actor(Guid? Id, string Name)
{
    public static readonly Actor Checkout = new(null, "Customer checkout");
    public static readonly Actor PaymentSystem = new(null, "Payment system");
}

/// <summary>Result of one stock movement.</summary>
public sealed record StockMovement(int VariantId, int PreviousQuantity, int NewQuantity, InventoryTransaction Transaction);

/// <summary>
/// The only place that changes <see cref="ProductVariant.StockQuantity"/>. Each change is a single
/// conditional UPDATE (so concurrent requests can't oversell or push stock below zero) followed by an
/// <see cref="InventoryTransaction"/> audit row. Call it inside a database transaction and save afterwards.
/// </summary>
public interface IInventoryLedger
{
    /// <summary>Applies <paramref name="change"/> to the variant. Returns null if it would make stock negative.</summary>
    Task<StockMovement?> TryApplyAsync(
        int variantId, int change, InventoryTransactionType type, string reason, string? reference, Actor actor,
        CancellationToken ct, int? stockReceiptId = null);
}

public sealed class InventoryLedger(IAppDbContext db, IClock clock) : IInventoryLedger
{
    public async Task<StockMovement?> TryApplyAsync(
        int variantId, int change, InventoryTransactionType type, string reason, string? reference, Actor actor,
        CancellationToken ct, int? stockReceiptId = null)
    {
        if (change == 0) throw new ArgumentOutOfRangeException(nameof(change), "A stock movement must change the quantity.");

        var now = clock.UtcNow;
        var updated = await db.ProductVariants
            .Where(v => v.Id == variantId && v.StockQuantity + change >= 0)
            .ExecuteUpdateAsync(s => s
                .SetProperty(v => v.StockQuantity, v => v.StockQuantity + change)
                .SetProperty(v => v.ModifiedUtc, (DateTime?)now), ct);
        if (updated == 0) return null;

        // The row is locked by our UPDATE until the surrounding transaction ends, so this read is exact.
        var info = await db.ProductVariants.AsNoTracking()
            .Where(v => v.Id == variantId)
            .Select(v => new
            {
                v.StockQuantity,
                v.Sku,
                ProductCode = v.Product.Code,
                ProductName = v.Product.Name,
                ColourName = v.Colour.Name,
                Size = v.Size.Code,
            })
            .FirstAsync(ct);

        var transaction = new InventoryTransaction
        {
            ProductVariantId = variantId,
            Sku = info.Sku,
            ProductCode = info.ProductCode,
            ProductName = info.ProductName,
            ColourName = info.ColourName,
            Size = info.Size,
            Type = type,
            QuantityChange = change,
            PreviousQuantity = info.StockQuantity - change,
            NewQuantity = info.StockQuantity,
            Reason = reason.Length <= 300 ? reason : reason[..300],
            Reference = reference,
            StockReceiptId = stockReceiptId,
            PerformedById = actor.Id,
            PerformedByName = actor.Name,
            CreatedUtc = now,
        };
        db.InventoryTransactions.Add(transaction);
        return new StockMovement(variantId, info.StockQuantity - change, info.StockQuantity, transaction);
    }
}
