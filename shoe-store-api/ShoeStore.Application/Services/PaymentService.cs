using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Options;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services;

public interface IPaymentService
{
    PaymentOptionsDto GetOptions();

    /// <summary>Builds the signed PayHere hosted-checkout form for an order awaiting payment.</summary>
    Task<HostedCheckoutDto> CreatePayHereCheckoutAsync(string orderNumber, Guid? customerId, string? email, string fallbackNotifyUrl, CancellationToken ct);

    /// <summary>Handles PayHere's server-to-server notification. Returns false when the notification is rejected.</summary>
    Task<bool> HandlePayHereNotificationAsync(IReadOnlyDictionary<string, string> form, CancellationToken ct);

    /// <summary>Cancels card orders whose payment window has passed and releases their stock.</summary>
    Task<int> ExpireUnpaidOrdersAsync(CancellationToken ct);
}

/// <summary>
/// PayHere hosted checkout. Card details are entered on PayHere's own page and never reach this API.
/// An order only becomes <see cref="PaymentStatus.Paid"/> after a notification whose MD5 signature,
/// merchant id, amount and currency all verify. The browser's return to the storefront proves nothing.
/// </summary>
public sealed class PaymentService(
    IAppDbContext db,
    IClock clock,
    IOptions<PayHereOptions> payHereOptions,
    IOptions<PaymentOptions> paymentOptions,
    IInventoryLedger ledger,
    ILogger<PaymentService> logger) : IPaymentService
{
    public const string PayHereProvider = "PayHere";
    private readonly PayHereOptions _payHere = payHereOptions.Value;
    private readonly PaymentOptions _payments = paymentOptions.Value;

    public PaymentOptionsDto GetOptions() =>
        new(_payHere.IsConfigured, _payments.AllowSimulated, _payHere.UseSandbox);

    // ------------------------------------------------------------------ Checkout

    public async Task<HostedCheckoutDto> CreatePayHereCheckoutAsync(
        string orderNumber, Guid? customerId, string? email, string fallbackNotifyUrl, CancellationToken ct)
    {
        if (!_payHere.IsConfigured)
            throw new BusinessRuleException("Card payments aren't available right now. Please try again later.", "payments_unavailable");

        var number = orderNumber.Trim().ToUpperInvariant();
        var order = await db.Orders.AsNoTracking()
            .Include(o => o.Items)
            .Include(o => o.ShippingAddress)
            .FirstOrDefaultAsync(o => o.OrderNumber == number, ct);

        var notFound = new NotFoundException("We couldn't find that order. Check the order number in your confirmation.", "order_not_found");
        if (order is null) throw notFound;
        if (order.CustomerId is { } owner)
        {
            if (customerId != owner) throw notFound;
        }
        else if (string.IsNullOrWhiteSpace(email) || !string.Equals(order.Email, email.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            throw notFound;
        }

        if (order.PaymentProvider != PayHereProvider)
            throw new BusinessRuleException("This order doesn't need a card payment.", "payment_not_required");
        if (order.PaymentStatus == PaymentStatus.Paid)
            throw new ConflictException("This order has already been paid.", "already_paid");
        if (!OrderWorkflow.CanTakePayment(order.Status) || order.PaymentStatus is not (PaymentStatus.Pending or PaymentStatus.Failed))
            throw new ConflictException("This order can no longer be paid. Please place a new order.", "payment_closed");
        if (order.PaymentExpiresUtc is { } expires && expires <= clock.UtcNow)
            throw new ConflictException("The time to pay for this order has passed and the items were released. Please place a new order.", "payment_expired");

        var a = order.ShippingAddress;
        var amount = FormatAmount(order.GrandTotal);
        var baseUrl = _payHere.FrontendBaseUrl.TrimEnd('/');
        var notifyUrl = string.IsNullOrWhiteSpace(_payHere.NotifyUrl) ? fallbackNotifyUrl : _payHere.NotifyUrl;
        var pairs = order.Items.Sum(i => i.Quantity);
        var items = pairs == 1
            ? Truncate(order.Items.First().ProductName.StartsWith(order.Items.First().BrandName, StringComparison.OrdinalIgnoreCase)
                ? order.Items.First().ProductName
                : $"{order.Items.First().BrandName} {order.Items.First().ProductName}", 100)
            : $"Nishoes order {order.OrderNumber} ({pairs} pairs)";

        var fields = new Dictionary<string, string>
        {
            ["merchant_id"] = _payHere.MerchantId,
            ["return_url"] = $"{baseUrl}/payment/return?order={Uri.EscapeDataString(order.OrderNumber)}",
            ["cancel_url"] = $"{baseUrl}/payment/cancel?order={Uri.EscapeDataString(order.OrderNumber)}",
            ["notify_url"] = notifyUrl,
            ["order_id"] = order.OrderNumber,
            ["items"] = items,
            ["currency"] = order.Currency,
            ["amount"] = amount,
            ["first_name"] = a.FirstName,
            ["last_name"] = a.LastName,
            ["email"] = order.Email,
            ["phone"] = a.Phone,
            ["address"] = string.IsNullOrWhiteSpace(a.Line2) ? a.Line1 : $"{a.Line1}, {a.Line2}",
            ["city"] = a.City,
            ["country"] = "Sri Lanka",
            ["hash"] = CheckoutHash(order.OrderNumber, amount, order.Currency),
        };

        logger.LogInformation("PayHere checkout started for {OrderNumber} ({Amount} {Currency})", order.OrderNumber, amount, order.Currency);
        return new HostedCheckoutDto(_payHere.CheckoutUrl, fields, order.PaymentExpiresUtc);
    }

    // ------------------------------------------------------------------ Notification

    public async Task<bool> HandlePayHereNotificationAsync(IReadOnlyDictionary<string, string> form, CancellationToken ct)
    {
        string Get(string key) => form.TryGetValue(key, out var v) ? v.Trim() : string.Empty;

        var merchantId = Get("merchant_id");
        var orderNumber = Get("order_id").ToUpperInvariant();
        var paymentId = Get("payment_id");
        var amountText = Get("payhere_amount");
        var currency = Get("payhere_currency");
        var statusText = Get("status_code");
        var signature = Get("md5sig");

        if (!_payHere.IsConfigured || orderNumber.Length == 0 ||
            !int.TryParse(statusText, NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var statusCode))
        {
            logger.LogWarning("PayHere notification rejected: missing fields or payments not configured");
            return false;
        }

        var expected = NotifySignature(merchantId, orderNumber, amountText, currency, statusText);
        var signatureValid = merchantId == _payHere.MerchantId &&
                             CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(signature.ToUpperInvariant()));

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var order = await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.OrderNumber == orderNumber, ct);
        if (order is null)
        {
            logger.LogWarning("PayHere notification for unknown order {OrderNumber}", orderNumber);
            return false;
        }

        decimal.TryParse(amountText, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount);
        var mapped = statusCode switch
        {
            2 => PaymentStatus.Paid,
            -2 => PaymentStatus.Failed,
            -3 => PaymentStatus.Refunded,
            _ => PaymentStatus.Pending, // 0 pending, -1 cancelled by the shopper: still payable
        };

        var now = clock.UtcNow;
        db.PaymentTransactions.Add(new PaymentTransaction
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            Provider = PayHereProvider,
            ProviderPaymentId = Truncate(paymentId, 64),
            Amount = amount,
            Currency = Truncate(currency, 3),
            StatusCode = statusCode,
            Status = mapped,
            Method = Truncate(Get("method"), 20),
            Message = Truncate(Get("status_message"), 200),
            SignatureValid = signatureValid,
            CreatedUtc = now,
        });

        if (!signatureValid)
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            logger.LogWarning("PayHere notification for {OrderNumber} failed signature verification; ignored", orderNumber);
            return false;
        }

        if (amount != order.GrandTotal || !string.Equals(currency, order.Currency, StringComparison.OrdinalIgnoreCase))
        {
            AddHistory(order, now, $"Payment notification ignored: amount {amountText} {currency} doesn't match the order total.");
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            logger.LogError("PayHere amount mismatch on {OrderNumber}: got {Amount} {Currency}, expected {Expected} {OrderCurrency}",
                orderNumber, amountText, currency, order.GrandTotal, order.Currency);
            return false;
        }

        switch (mapped)
        {
            case PaymentStatus.Paid when order.PaymentStatus == PaymentStatus.Paid:
                break; // Repeated notification: nothing more to do.

            case PaymentStatus.Paid:
                await MarkPaidAsync(order, paymentId, Get("method"), now, ct);
                break;

            case PaymentStatus.Failed when order.PaymentStatus is PaymentStatus.Pending:
                order.PaymentStatus = PaymentStatus.Failed;
                AddHistory(order, now, "Card payment was declined. The order is held so the shopper can try again.");
                break;

            case PaymentStatus.Refunded when order.PaymentStatus == PaymentStatus.Paid:
                order.PaymentStatus = PaymentStatus.Refunded;
                AddHistory(order, now, "Payment was charged back by the card issuer.");
                logger.LogWarning("Chargeback received for {OrderNumber}", orderNumber);
                break;

            case PaymentStatus.Pending when statusCode == -1 && order.PaymentStatus is PaymentStatus.Pending or PaymentStatus.Failed:
                AddHistory(order, now, "Shopper left the payment page without paying.");
                break;
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        logger.LogInformation("PayHere notification for {OrderNumber}: status {StatusCode} → payment {PaymentStatus}", orderNumber, statusCode, order.PaymentStatus);
        return true;
    }

    private async Task MarkPaidAsync(Order order, string paymentId, string method, DateTime now, CancellationToken ct)
    {
        order.PaymentStatus = PaymentStatus.Paid;
        order.PaymentReference = Truncate(paymentId, 120);
        order.PaymentExpiresUtc = null;

        if (order.Status != OrderStatus.Cancelled)
        {
            AddHistory(order, now, $"Payment received via PayHere{(method.Length > 0 ? $" ({method})" : "")}. Reference {paymentId}.");
            return;
        }

        // The owner cancelled this order on purpose: keep it cancelled and flag the payment for a refund.
        var cancelledByOwner = await db.OrderStatusHistory.AsNoTracking()
            .AnyAsync(h => h.OrderId == order.Id && h.Status == OrderStatus.Cancelled && h.ChangedById != null, ct);
        if (cancelledByOwner)
        {
            AddHistory(order, now, $"Payment {paymentId} arrived after the store cancelled this order. Refund it in the PayHere portal.");
            logger.LogError("Order {OrderNumber} was cancelled by the store but payment {PaymentId} arrived; refund required", order.OrderNumber, paymentId);
            return;
        }

        // Paid after the reservation expired: try to reserve the stock again (recorded in the inventory ledger).
        var reserved = new List<(int VariantId, int Quantity)>();
        foreach (var item in order.Items.Where(i => i.ProductVariantId is not null))
        {
            var variantId = item.ProductVariantId!.Value;
            var movement = await ledger.TryApplyAsync(
                variantId, -item.Quantity, InventoryTransactionType.Sale, "Reserved again: payment arrived after expiry", order.OrderNumber, Actor.PaymentSystem, ct);
            if (movement is null)
            {
                foreach (var (rid, rq) in reserved)
                    await ledger.TryApplyAsync(rid, rq, InventoryTransactionType.Released, "Re-reservation undone: another item is out of stock", order.OrderNumber, Actor.PaymentSystem, ct);
                AddHistory(order, now, $"Payment {paymentId} arrived after the order expired and an item is now out of stock. Refund required.");
                logger.LogError("Order {OrderNumber} paid after expiry but stock is gone; refund payment {PaymentId}", order.OrderNumber, paymentId);
                return;
            }
            reserved.Add((variantId, item.Quantity));
        }

        order.Status = OrderStatus.Pending;
        AddHistory(order, now, $"Payment {paymentId} arrived after the reservation expired; items reserved again and the order reopened.");
    }

    // ------------------------------------------------------------------ Expiry

    public async Task<int> ExpireUnpaidOrdersAsync(CancellationToken ct)
    {
        var now = clock.UtcNow;
        var candidates = await db.Orders.AsNoTracking()
            .Where(o => o.PaymentProvider == PayHereProvider &&
                        (o.Status == OrderStatus.Pending || o.Status == OrderStatus.Confirmed || o.Status == OrderStatus.Processing) &&
                        (o.PaymentStatus == PaymentStatus.Pending || o.PaymentStatus == PaymentStatus.Failed) &&
                        o.PaymentExpiresUtc != null && o.PaymentExpiresUtc < now)
            .Select(o => o.Id)
            .Take(50)
            .ToListAsync(ct);

        var expired = 0;
        foreach (var id in candidates)
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);

            // Claim the order atomically so a payment arriving at the same moment wins cleanly.
            var claimed = await db.Orders
                .Where(o => o.Id == id &&
                            (o.Status == OrderStatus.Pending || o.Status == OrderStatus.Confirmed || o.Status == OrderStatus.Processing) &&
                            (o.PaymentStatus == PaymentStatus.Pending || o.PaymentStatus == PaymentStatus.Failed))
                .ExecuteUpdateAsync(s => s
                    .SetProperty(o => o.Status, OrderStatus.Cancelled)
                    .SetProperty(o => o.PaymentStatus, PaymentStatus.Failed), ct);
            if (claimed == 0) { await tx.RollbackAsync(ct); continue; }

            var info = await db.Orders.AsNoTracking().Where(o => o.Id == id)
                .Select(o => new { o.OrderNumber, o.CouponCode }).FirstAsync(ct);
            var items = await db.OrderItems.AsNoTracking()
                .Where(i => i.OrderId == id && i.ProductVariantId != null)
                .Select(i => new { VariantId = i.ProductVariantId!.Value, i.Quantity })
                .ToListAsync(ct);
            foreach (var item in items)
            {
                await ledger.TryApplyAsync(item.VariantId, item.Quantity, InventoryTransactionType.Released,
                    "Payment window expired", info.OrderNumber, Actor.PaymentSystem, ct);
            }

            var coupon = info.CouponCode;
            if (!string.IsNullOrEmpty(coupon))
                await db.Coupons.Where(c => c.Code == coupon && c.TimesUsed > 0)
                    .ExecuteUpdateAsync(s => s.SetProperty(c => c.TimesUsed, c => c.TimesUsed - 1), ct);

            db.OrderStatusHistory.Add(new OrderStatusHistory
            {
                OrderId = id,
                Status = OrderStatus.Cancelled,
                Note = "Cancelled: payment wasn't completed in time. Items returned to stock.",
                CreatedUtc = now,
            });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            expired++;
        }

        if (expired > 0) logger.LogInformation("Cancelled {Count} unpaid card order(s) and released their stock", expired);
        return expired;
    }

    // ------------------------------------------------------------------ Helpers

    private static void AddHistory(Order order, DateTime now, string note) =>
        order.StatusHistory.Add(new OrderStatusHistory { OrderId = order.Id, Status = order.Status, Note = Truncate(note, 300), CreatedUtc = now });

    /// <summary>PayHere amounts: two decimals, dot separator, no grouping.</summary>
    public static string FormatAmount(decimal amount) => amount.ToString("0.00", CultureInfo.InvariantCulture);

    private string SecretHash() => Md5Upper(_payHere.MerchantSecret);

    /// <summary>UPPER(MD5(merchant_id + order_id + amount + currency + UPPER(MD5(secret)))).</summary>
    public string CheckoutHash(string orderId, string amount, string currency) =>
        Md5Upper(_payHere.MerchantId + orderId + amount + currency + SecretHash());

    /// <summary>UPPER(MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(MD5(secret)))).</summary>
    public string NotifySignature(string merchantId, string orderId, string amount, string currency, string statusCode) =>
        Md5Upper(merchantId + orderId + amount + currency + statusCode + SecretHash());

    private static string Md5Upper(string value) =>
        Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(value)));

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
