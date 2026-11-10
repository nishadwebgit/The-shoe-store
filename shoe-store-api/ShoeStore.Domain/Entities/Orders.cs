using ShoeStore.Domain.Common;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Domain.Entities;

/// <summary>
/// A placed order. Monetary values and product details are copied at the time of purchase,
/// so later catalogue or price changes never alter order history.
/// </summary>
public class Order : AuditableEntity
{
    public Guid Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;

    /// <summary>Null for guest checkouts.</summary>
    public Guid? CustomerId { get; set; }
    public Customer? Customer { get; set; }

    public string Email { get; set; } = string.Empty;
    public OrderStatus Status { get; set; } = OrderStatus.Pending;
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Simulated;

    /// <summary>"Simulated" for demo orders, or the gateway name, e.g. "PayHere".</summary>
    public string PaymentProvider { get; set; } = "Simulated";

    /// <summary>Gateway reference such as a PayHere payment id. Never card data.</summary>
    public string? PaymentReference { get; set; }

    /// <summary>
    /// For card orders awaiting payment: when the stock reservation ends. Unpaid orders are
    /// cancelled after this time and their stock is released.
    /// </summary>
    public DateTime? PaymentExpiresUtc { get; set; }

    public ICollection<PaymentTransaction> PaymentTransactions { get; set; } = new List<PaymentTransaction>();

    public string ShippingMethodCode { get; set; } = string.Empty;
    public string ShippingMethodName { get; set; } = string.Empty;
    public DateTime EstimatedDeliveryFromUtc { get; set; }
    public DateTime EstimatedDeliveryToUtc { get; set; }

    public string Currency { get; set; } = "LKR";
    public decimal Subtotal { get; set; }
    public decimal DiscountTotal { get; set; }
    public decimal ShippingTotal { get; set; }
    public decimal GrandTotal { get; set; }
    public string? CouponCode { get; set; }

    public DateTime PlacedUtc { get; set; }

    public OrderAddress ShippingAddress { get; set; } = null!;
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
    public ICollection<OrderStatusHistory> StatusHistory { get; set; } = new List<OrderStatusHistory>();
}

/// <summary>Snapshot of the delivery address at the time of ordering.</summary>
public class OrderAddress
{
    public Guid OrderId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Line1 { get; set; } = string.Empty;
    public string? Line2 { get; set; }
    public string City { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public string PostalCode { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
}

public class OrderItem
{
    public int Id { get; set; }
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    /// <summary>Kept for reporting; set to null if the variant is ever deleted.</summary>
    public int? ProductVariantId { get; set; }

    public string Sku { get; set; } = string.Empty;
    public string ProductCode { get; set; } = string.Empty;
    public string ProductSlug { get; set; } = string.Empty;
    public string ProductName { get; set; } = string.Empty;
    public string BrandName { get; set; } = string.Empty;
    public string ColourCode { get; set; } = string.Empty;
    public string ColourName { get; set; } = string.Empty;
    public string Size { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public decimal UnitPrice { get; set; }
    public int Quantity { get; set; }
    public decimal LineTotal { get; set; }
}

/// <summary>
/// One notification from a payment gateway (e.g. a PayHere notify callback), kept for auditing and to
/// make repeated notifications harmless. Never contains card numbers.
/// </summary>
public class PaymentTransaction
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Order Order { get; set; } = null!;

    /// <summary>Gateway name, e.g. "PayHere".</summary>
    public string Provider { get; set; } = string.Empty;

    /// <summary>The gateway's payment id (PayHere payment_id).</summary>
    public string? ProviderPaymentId { get; set; }

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "LKR";

    /// <summary>Raw gateway status code (PayHere: 2 success, 0 pending, -1 cancelled, -2 failed, -3 charged back).</summary>
    public int StatusCode { get; set; }

    /// <summary>Payment status this notification maps to.</summary>
    public PaymentStatus Status { get; set; }

    /// <summary>Payment method reported by the gateway, e.g. VISA, MASTER, AMEX.</summary>
    public string? Method { get; set; }

    /// <summary>Gateway status message, if any.</summary>
    public string? Message { get; set; }

    /// <summary>True when the notification signature verified. Unverified notifications are stored but ignored.</summary>
    public bool SignatureValid { get; set; }

    public DateTime CreatedUtc { get; set; }
}

public class OrderStatusHistory
{
    public int Id { get; set; }
    public Guid OrderId { get; set; }
    public OrderStatus Status { get; set; }
    public string? Note { get; set; }

    /// <summary>Owner/admin who made the change; null for automatic changes (checkout, payments).</summary>
    public Guid? ChangedById { get; set; }
    public string? ChangedByName { get; set; }
    public DateTime CreatedUtc { get; set; }
}
