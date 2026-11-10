namespace ShoeStore.Domain.Enums;

/// <summary>Who a shoe is made for. Unisex products appear under both Men and Women.</summary>
public enum Gender
{
    Men = 1,
    Women = 2,
    Kids = 3,
    Unisex = 4,
}

/// <summary>Sizing scale used by a product.</summary>
public enum SizeSystem
{
    Adult = 1,
    Kids = 2,
}

/// <summary>How a shoe fits compared with its labelled size.</summary>
public enum FitType
{
    TrueToSize = 1,
    RunsSmall = 2,
    RunsLarge = 3,
}

public enum CustomerRole
{
    Customer = 1,
    Admin = 2,
}

public enum CouponType
{
    Percent = 1,
    Fixed = 2,
    FreeShipping = 3,
}

/// <summary>
/// Fulfilment status. Normal flow: Pending → Confirmed → Processing → ReadyForDispatch → Shipped → Delivered.
/// Stored as text, so the numbers only matter for ordering in code. Payment status is tracked separately.
/// </summary>
public enum OrderStatus
{
    Processing = 1,
    Shipped = 2,
    Delivered = 3,
    Cancelled = 4,
    Pending = 5,
    Confirmed = 6,
    ReadyForDispatch = 7,
}

/// <summary>Why a variant's stock changed.</summary>
public enum InventoryTransactionType
{
    /// <summary>Stock received from a supplier.</summary>
    Received = 1,
    /// <summary>Reserved by a customer order at checkout.</summary>
    Sale = 2,
    /// <summary>Returned to stock because an order was cancelled or its payment window expired.</summary>
    Released = 3,
    /// <summary>Manual correction after a stock count (positive or negative).</summary>
    Correction = 4,
    Damaged = 5,
    Lost = 6,
    /// <summary>Customer return put back into sellable stock.</summary>
    Returned = 7,
}

/// <summary>
/// Payment state. <see cref="Simulated"/> is used by the demo checkout: no money was taken.
/// Real gateway integrations should move orders through Pending → Paid / Failed.
/// </summary>
public enum PaymentStatus
{
    Simulated = 1,
    Pending = 2,
    Paid = 3,
    Failed = 4,
    Refunded = 5,
}
