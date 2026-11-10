using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services.Admin;

public interface IAdminOrderService
{
    Task<PagedResult<AdminOrderListItemDto>> ListAsync(AdminOrderQuery query, CancellationToken ct);
    Task<AdminOrderCountsDto> CountsAsync(CancellationToken ct);
    Task<AdminOrderDto> GetAsync(string orderNumber, CancellationToken ct);
    Task<AdminOrderDto> UpdateStatusAsync(string orderNumber, UpdateOrderStatusRequest request, CancellationToken ct);
    Task<PagedResult<AdminCustomerDto>> CustomersAsync(AdminCustomerQuery query, CancellationToken ct);
    Task<AdminDashboardDto> DashboardAsync(CancellationToken ct);
}

/// <summary>
/// Order fulfilment for the Owner Portal. Stock was already reserved at checkout, so moving an order
/// forward never touches inventory; cancelling an open order returns its items to stock through the
/// inventory ledger. Payment status is never changed here.
/// </summary>
public sealed class AdminOrderService(
    IAppDbContext db,
    IAdminContext admin,
    IInventoryLedger ledger,
    IInventoryAdminService inventory,
    IClock clock,
    ILogger<AdminOrderService> logger) : IAdminOrderService
{
    // ------------------------------------------------------------------ List & counts

    public async Task<PagedResult<AdminOrderListItemDto>> ListAsync(AdminOrderQuery q, CancellationToken ct)
    {
        var (page, pageSize) = AdminMapping.Paging(q.Page, q.PageSize);
        var query = db.Orders.AsNoTracking().AsQueryable();

        var statuses = ApiValues.SplitList(q.Status).Select(ApiValues.ParseOrderStatus).Where(s => s is not null).Select(s => s!.Value).ToList();
        if (statuses.Count > 0) query = query.Where(o => statuses.Contains(o.Status));
        if (AdminMapping.NullIfEmpty(q.Payment) is { } paymentText && ApiValues.ParsePaymentStatus(paymentText) is { } payment)
            query = query.Where(o => o.PaymentStatus == payment);
        if (AdminMapping.NullIfEmpty(q.Search) is { } search)
            query = query.Where(o => o.OrderNumber.Contains(search) || o.Email.Contains(search) ||
                                     o.ShippingAddress.FirstName.Contains(search) || o.ShippingAddress.LastName.Contains(search) ||
                                     (o.ShippingAddress.FirstName + " " + o.ShippingAddress.LastName).Contains(search) ||
                                     o.ShippingAddress.Phone.Contains(search));
        if (q.From is { } from) query = query.Where(o => o.PlacedUtc >= from.Date);
        if (q.To is { } to) query = query.Where(o => o.PlacedUtc < to.Date.AddDays(1));

        var total = await query.CountAsync(ct);
        var items = await ProjectListAsync(query.OrderByDescending(o => o.PlacedUtc).Skip((page - 1) * pageSize).Take(pageSize), ct);
        return PagedResult<AdminOrderListItemDto>.Create(items, page, pageSize, total);
    }

    private static async Task<List<AdminOrderListItemDto>> ProjectListAsync(IQueryable<Order> query, CancellationToken ct)
    {
        var rows = await query.Select(o => new
        {
            o.OrderNumber,
            Name = o.ShippingAddress.FirstName + " " + o.ShippingAddress.LastName,
            o.Email,
            o.CustomerId,
            o.PlacedUtc,
            o.GrandTotal,
            o.Currency,
            o.Status,
            o.PaymentStatus,
            o.PaymentProvider,
            Items = o.Items.Sum(i => i.Quantity),
        }).ToListAsync(ct);

        return rows.Select(o => new AdminOrderListItemDto(
            o.OrderNumber, o.Name, o.Email, o.CustomerId is null, o.PlacedUtc, o.GrandTotal, o.Currency,
            o.Status.ToApi(), o.PaymentStatus.ToApi(),
            o.PaymentStatus == PaymentStatus.Simulated ? "demo" : o.PaymentProvider.ToLowerInvariant(),
            o.Items,
            OrderWorkflow.AllowedTransitions(o.Status).Select(s => s.ToApi()).ToList())).ToList();
    }

    public async Task<AdminOrderCountsDto> CountsAsync(CancellationToken ct)
    {
        var byStatus = await db.Orders.AsNoTracking().GroupBy(o => o.Status)
            .Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var awaiting = await db.Orders.AsNoTracking().CountAsync(o =>
            (o.PaymentStatus == PaymentStatus.Pending || o.PaymentStatus == PaymentStatus.Failed) &&
            (o.Status == OrderStatus.Pending || o.Status == OrderStatus.Confirmed || o.Status == OrderStatus.Processing), ct);
        var dict = Enum.GetValues<OrderStatus>().ToDictionary(s => s.ToApi(), s => byStatus.FirstOrDefault(x => x.Key == s)?.Count ?? 0);
        return new AdminOrderCountsDto(dict, awaiting, byStatus.Sum(x => x.Count));
    }

    // ------------------------------------------------------------------ Detail

    public async Task<AdminOrderDto> GetAsync(string orderNumber, CancellationToken ct)
    {
        var number = orderNumber.Trim().ToUpperInvariant();
        var order = await db.Orders.AsNoTracking().AsSplitQuery()
            .Include(o => o.Items)
            .Include(o => o.ShippingAddress)
            .Include(o => o.StatusHistory)
            .Include(o => o.PaymentTransactions)
            .FirstOrDefaultAsync(o => o.OrderNumber == number, ct)
            ?? throw new NotFoundException("We couldn't find that order.", "order_not_found");

        var customer = order.CustomerId is { } customerId
            ? await db.Customers.AsNoTracking().Where(c => c.Id == customerId)
                .Select(c => new { c.FirstName, c.LastName, c.Email, c.Phone, c.CreatedUtc }).FirstOrDefaultAsync(ct)
            : null;
        var orderCount = await db.Orders.AsNoTracking().CountAsync(o =>
            order.CustomerId != null ? o.CustomerId == order.CustomerId : o.Email == order.Email, ct);

        var a = order.ShippingAddress;
        var customerDto = new AdminOrderCustomerDto(
            order.CustomerId,
            customer is null ? $"{a.FirstName} {a.LastName}" : $"{customer.FirstName} {customer.LastName}",
            order.Email,
            customer?.Phone ?? a.Phone,
            order.CustomerId is null,
            orderCount,
            customer?.CreatedUtc);

        var settled = OrderWorkflow.IsPaymentSettled(order.PaymentStatus);
        string? blockReason = settled ? null : order.PaymentStatus switch
        {
            PaymentStatus.Pending => "Waiting for the customer's card payment. The order can't be dispatched until it's paid.",
            PaymentStatus.Failed => "The last card payment failed. The order can't be dispatched until it's paid.",
            PaymentStatus.Refunded => "The payment was refunded or charged back. Don't dispatch this order.",
            _ => null,
        };

        return new AdminOrderDto(
            order.ToDto(),
            customerDto,
            order.PaymentTransactions.OrderBy(t => t.CreatedUtc).Select(t => new AdminPaymentTransactionDto(
                t.CreatedUtc, t.Provider, t.ProviderPaymentId, t.Amount, t.Currency, t.StatusCode, t.Status.ToApi(), t.Method,
                t.SignatureValid, t.Message)).ToList(),
            order.StatusHistory.OrderBy(h => h.CreatedUtc).ThenBy(h => h.Id).Select(h => new AdminOrderHistoryDto(
                h.Status.ToApi(), h.Note, h.ChangedByName ?? "System", h.CreatedUtc)).ToList(),
            OrderWorkflow.AllowedTransitions(order.Status).Select(s => s.ToApi()).ToList(),
            settled,
            blockReason);
    }

    // ------------------------------------------------------------------ Status changes

    public async Task<AdminOrderDto> UpdateStatusAsync(string orderNumber, UpdateOrderStatusRequest r, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);
        var target = ApiValues.ParseOrderStatus(r.Status) ?? throw new BusinessRuleException("Choose a valid order status.", "invalid_status");
        var number = orderNumber.Trim().ToUpperInvariant();
        var order = await db.Orders.AsNoTracking()
            .Where(o => o.OrderNumber == number)
            .Select(o => new { o.Id, o.Status, o.PaymentStatus, o.CouponCode })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("We couldn't find that order.", "order_not_found");

        if (!OrderWorkflow.AllowedTransitions(order.Status).Contains(target))
            throw new BusinessRuleException(
                $"An order that is {OrderWorkflow.Label(order.Status).ToLowerInvariant()} can't move to {OrderWorkflow.Label(target).ToLowerInvariant()}.",
                "invalid_transition");
        if (OrderWorkflow.RequiresPayment(target) && !OrderWorkflow.IsPaymentSettled(order.PaymentStatus))
            throw new BusinessRuleException("This order hasn't been paid yet, so it can't be prepared for dispatch.", "payment_required");

        var note = AdminMapping.NullIfEmpty(r.Note);
        if (target == OrderStatus.Cancelled && note is null)
            throw new BusinessRuleException("Give a reason for cancelling the order.", "reason_required");

        var now = clock.UtcNow;
        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Only succeeds if nobody (or the payment-expiry job) changed the status in the meantime.
        var from = order.Status;
        var changed = await db.Orders
            .Where(o => o.Id == order.Id && o.Status == from)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, target).SetProperty(o => o.ModifiedUtc, (DateTime?)now), ct);
        if (changed == 0)
        {
            await tx.RollbackAsync(ct);
            throw new ConflictException("This order was updated by someone else a moment ago. Refresh and try again.", "order_changed");
        }

        var historyNote = note;
        if (target == OrderStatus.Cancelled)
        {
            // Return reserved stock: the items never left the store.
            var items = await db.OrderItems.AsNoTracking()
                .Where(i => i.OrderId == order.Id && i.ProductVariantId != null)
                .Select(i => new { VariantId = i.ProductVariantId!.Value, i.Quantity })
                .ToListAsync(ct);
            foreach (var item in items)
                await ledger.TryApplyAsync(item.VariantId, item.Quantity, InventoryTransactionType.Released,
                    $"Order cancelled: {note}", number, actor, ct);

            if (!string.IsNullOrEmpty(order.CouponCode))
                await db.Coupons.Where(c => c.Code == order.CouponCode && c.TimesUsed > 0)
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.TimesUsed, c => c.TimesUsed - 1), ct);

            historyNote = order.PaymentStatus == PaymentStatus.Paid
                ? $"Cancelled: {note}. Items returned to stock. The customer has paid: refund them in the PayHere portal."
                : $"Cancelled: {note}. Items returned to stock.";
        }

        db.OrderStatusHistory.Add(new OrderStatusHistory
        {
            OrderId = order.Id,
            Status = target,
            Note = historyNote is { Length: > 300 } ? historyNote[..300] : historyNote,
            ChangedById = actor.Id,
            ChangedByName = actor.Name,
            CreatedUtc = now,
        });
        admin.Audit(actor, "order.status", "order", number, $"{number}: {OrderWorkflow.Label(from)} → {OrderWorkflow.Label(target)}");
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        logger.LogInformation("Order {OrderNumber} moved {From} → {To} by {Actor}", number, from, target, actor.Name);
        return await GetAsync(number, ct);
    }

    // ------------------------------------------------------------------ Customers

    public async Task<PagedResult<AdminCustomerDto>> CustomersAsync(AdminCustomerQuery q, CancellationToken ct)
    {
        var (page, pageSize) = AdminMapping.Paging(q.Page, q.PageSize);
        var query = db.Customers.AsNoTracking().AsQueryable();
        if (AdminMapping.NullIfEmpty(q.Search) is { } search)
            query = query.Where(c => c.Email.Contains(search) || c.FirstName.Contains(search) || c.LastName.Contains(search) ||
                                     (c.FirstName + " " + c.LastName).Contains(search) || (c.Phone != null && c.Phone.Contains(search)));
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(c => c.CreatedUtc)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(c => new
            {
                c.Id,
                Name = c.FirstName + " " + c.LastName,
                c.Email,
                c.Phone,
                c.CreatedUtc,
                c.LastLoginUtc,
                c.Role,
                Orders = db.Orders.Where(o => o.CustomerId == c.Id).Select(o => new { o.Status, o.PaymentStatus, o.GrandTotal, o.PlacedUtc }).ToList(),
            })
            .ToListAsync(ct);

        var items = rows.Select(c => new AdminCustomerDto(
            c.Id, c.Name, c.Email, c.Phone, c.CreatedUtc, c.LastLoginUtc, c.Role.ToString().ToLowerInvariant(),
            c.Orders.Count,
            c.Orders.Where(o => o.Status != OrderStatus.Cancelled && OrderWorkflow.IsPaymentSettled(o.PaymentStatus)).Sum(o => o.GrandTotal),
            c.Orders.Count == 0 ? null : c.Orders.Max(o => o.PlacedUtc))).ToList();
        return PagedResult<AdminCustomerDto>.Create(items, page, pageSize, total);
    }

    // ------------------------------------------------------------------ Dashboard

    public async Task<AdminDashboardDto> DashboardAsync(CancellationToken ct)
    {
        var now = clock.UtcNow;
        var threshold = (await admin.GetSettingsAsync(ct)).LowStockThreshold;

        var totalProducts = await db.Products.AsNoTracking().CountAsync(ct);
        var activeProducts = await db.Products.AsNoTracking().CountAsync(p => p.IsActive, ct);
        var featuredProducts = await db.Products.AsNoTracking().CountAsync(p => p.IsActive && p.IsFeatured, ct);
        var products = new DashboardProductStats(totalProducts, activeProducts, totalProducts - activeProducts, featuredProducts);

        var variants = db.ProductVariants.AsNoTracking().Where(v => v.Product.IsActive);
        var stock = new DashboardStockStats(
            await variants.SumAsync(v => v.StockQuantity, ct),
            await variants.CountAsync(v => v.StockQuantity > 0 && v.StockQuantity <= (v.LowStockThreshold ?? threshold), ct),
            await variants.CountAsync(v => v.StockQuantity <= 0, ct),
            await db.Products.AsNoTracking().CountAsync(p => p.IsActive && !p.Variants.Any(v => v.StockQuantity > 0), ct),
            await db.StockReceipts.AsNoTracking().Where(r => r.CreatedUtc >= now.AddDays(-7)).SumAsync(r => (int?)r.TotalQuantity, ct) ?? 0);

        var counts = await CountsAsync(ct);
        int C(OrderStatus s) => counts.ByStatus.GetValueOrDefault(s.ToApi());
        var orders = new DashboardOrderStats(
            counts.Total,
            C(OrderStatus.Pending),
            C(OrderStatus.Confirmed) + C(OrderStatus.Processing),
            C(OrderStatus.ReadyForDispatch),
            C(OrderStatus.Shipped),
            C(OrderStatus.Delivered),
            C(OrderStatus.Cancelled),
            counts.AwaitingPayment);

        // Sales: orders that weren't cancelled and whose payment is settled (paid, or demo orders in development).
        var since = now.Date.AddDays(-29);
        var sold = await db.Orders.AsNoTracking()
            .Where(o => o.PlacedUtc >= since && o.Status != OrderStatus.Cancelled &&
                        (o.PaymentStatus == PaymentStatus.Paid || o.PaymentStatus == PaymentStatus.Simulated))
            .Select(o => new { o.PlacedUtc, o.GrandTotal, o.Currency })
            .ToListAsync(ct);
        var revenue = sold.Sum(o => o.GrandTotal);
        var sales = new DashboardSalesStats(revenue, sold.Count, sold.Count == 0 ? 0 : Math.Round(revenue / sold.Count, 2),
            sold.FirstOrDefault()?.Currency ?? "LKR");
        var daily = Enumerable.Range(0, 14)
            .Select(i => now.Date.AddDays(-13 + i))
            .Select(day => new DailySalesDto(day,
                sold.Count(o => o.PlacedUtc.Date == day),
                sold.Where(o => o.PlacedUtc.Date == day).Sum(o => o.GrandTotal)))
            .ToList();

        var recentReceipts = (await db.StockReceipts.AsNoTracking().OrderByDescending(r => r.CreatedUtc).Take(5).ToListAsync(ct))
            .Select(r => r.ToSummaryDto()).ToList();
        var recentMovements = (await db.InventoryTransactions.AsNoTracking().OrderByDescending(t => t.Id).Take(8).ToListAsync(ct))
            .Select(t => t.ToDto()).ToList();
        var recentOrders = await ProjectListAsync(db.Orders.AsNoTracking().OrderByDescending(o => o.PlacedUtc).Take(6), ct);

        return new AdminDashboardDto(products, stock, orders, sales, daily, await inventory.LowStockAsync(8, ct),
            recentReceipts, recentMovements, recentOrders);
    }
}
