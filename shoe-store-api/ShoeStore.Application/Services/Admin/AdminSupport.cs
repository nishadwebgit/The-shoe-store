using Microsoft.EntityFrameworkCore;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services.Admin;

/// <summary>Shared helpers for Owner Portal services: who is acting, audit records and store settings.</summary>
public interface IAdminContext
{
    /// <summary>The signed-in owner. Throws if the caller isn't an active admin (defence in depth: the API checks too).</summary>
    Task<Actor> GetActorAsync(CancellationToken ct);

    /// <summary>Adds an audit record (saved with the caller's next SaveChanges).</summary>
    void Audit(Actor actor, string action, string entityType, string entityId, string summary);

    Task<StoreSettings> GetSettingsAsync(CancellationToken ct);
}

public sealed class AdminContext(IAppDbContext db, ICurrentUser user, IClock clock) : IAdminContext
{
    private Actor? _actor;

    public async Task<Actor> GetActorAsync(CancellationToken ct)
    {
        if (_actor is not null) return _actor;
        if (user.CustomerId is not { } id) throw new UnauthorizedException("Sign in to continue.");
        var admin = await db.Customers.AsNoTracking()
            .Where(c => c.Id == id && c.Role == CustomerRole.Admin)
            .Select(c => new { c.FirstName, c.LastName })
            .FirstOrDefaultAsync(ct)
            ?? throw new ForbiddenException("Only store owners can do this.", "admin_required");
        return _actor = new Actor(id, $"{admin.FirstName} {admin.LastName}".Trim());
    }

    public void Audit(Actor actor, string action, string entityType, string entityId, string summary) =>
        db.AdminAuditLogs.Add(new AdminAuditLog
        {
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            Summary = summary.Length <= 500 ? summary : summary[..500],
            PerformedById = actor.Id,
            PerformedByName = actor.Name,
            CreatedUtc = clock.UtcNow,
        });

    public async Task<StoreSettings> GetSettingsAsync(CancellationToken ct)
    {
        var settings = await db.StoreSettings.FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (settings is not null) return settings;
        settings = new StoreSettings { Id = 1 };
        db.StoreSettings.Add(settings);
        await db.SaveChangesAsync(ct);
        return settings;
    }
}

public static class StockState
{
    public const string In = "in";
    public const string Low = "low";
    public const string Out = "out";

    public static string Of(int quantity, int threshold) =>
        quantity <= 0 ? Out : quantity <= threshold ? Low : In;
}

public static class AdminMapping
{
    public static InventoryTransactionDto ToDto(this InventoryTransaction t) => new(
        t.Id, t.CreatedUtc, t.Type.ToApi(), t.ProductVariantId, t.Sku, t.ProductCode, t.ProductName, t.ColourName, t.Size,
        t.QuantityChange, t.PreviousQuantity, t.NewQuantity, t.Reason, t.Reference, t.PerformedByName);

    public static StockReceiptSummaryDto ToSummaryDto(this StockReceipt r) => new(
        r.Id, r.ReceiptNumber, r.SupplierName, r.SupplierReference, r.ReceivedDate, r.ProductId, r.ProductCode, r.ProductName,
        r.TotalQuantity, r.UnitCost * r.TotalQuantity, r.ReceivedByName, r.CreatedUtc);

    public static StockReceiptDto ToDto(this StockReceipt r) => new(
        r.Id, r.ReceiptNumber, r.SupplierName, r.SupplierReference, r.ReceivedDate, r.ProductId, r.ProductCode, r.ProductName,
        r.UnitCost, r.SellingPrice, r.Notes, r.TotalQuantity, r.UnitCost * r.TotalQuantity, r.ReceivedByName, r.CreatedUtc,
        r.Items.OrderBy(i => i.Id)
            .Select(i => new StockReceiptLineDto(i.Sku, i.ColourName, i.Size, i.Quantity, i.PreviousQuantity, i.NewQuantity))
            .ToList());

    public static string Normalize(string? value) => (value ?? string.Empty).Trim();

    public static string? NullIfEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static (int Page, int PageSize) Paging(int page, int pageSize, int max = 100) =>
        (Math.Max(1, page), Math.Clamp(pageSize, 1, max));
}
