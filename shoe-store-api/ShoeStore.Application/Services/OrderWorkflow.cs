using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services;

/// <summary>
/// Order fulfilment rules. Fulfilment status and payment status are independent: moving an order
/// forward never changes its payment status, and only a verified payment marks it paid.
/// </summary>
public static class OrderWorkflow
{
    /// <summary>Statuses before the parcel leaves: stock is still reserved and the order can be cancelled.</summary>
    public static readonly OrderStatus[] Open =
        [OrderStatus.Pending, OrderStatus.Confirmed, OrderStatus.Processing, OrderStatus.ReadyForDispatch];

    /// <summary>Statuses in which an unpaid card order may still be paid (and may expire).</summary>
    public static readonly OrderStatus[] AwaitingPayment =
        [OrderStatus.Pending, OrderStatus.Confirmed, OrderStatus.Processing];

    public static bool IsOpen(OrderStatus status) => Open.Contains(status);

    public static bool CanTakePayment(OrderStatus status) => AwaitingPayment.Contains(status);

    /// <summary>The next step in the normal flow, or null when there is none.</summary>
    public static OrderStatus? Next(OrderStatus status) => status switch
    {
        OrderStatus.Pending => OrderStatus.Confirmed,
        OrderStatus.Confirmed => OrderStatus.Processing,
        OrderStatus.Processing => OrderStatus.ReadyForDispatch,
        OrderStatus.ReadyForDispatch => OrderStatus.Shipped,
        OrderStatus.Shipped => OrderStatus.Delivered,
        _ => null,
    };

    /// <summary>Statuses an owner may move an order to from <paramref name="status"/>.</summary>
    public static IReadOnlyList<OrderStatus> AllowedTransitions(OrderStatus status)
    {
        var list = new List<OrderStatus>();
        if (Next(status) is { } next) list.Add(next);
        if (IsOpen(status)) list.Add(OrderStatus.Cancelled);
        return list;
    }

    /// <summary>Steps from Ready for dispatch onwards need the money first.</summary>
    public static bool RequiresPayment(OrderStatus target) =>
        target is OrderStatus.ReadyForDispatch or OrderStatus.Shipped or OrderStatus.Delivered;

    public static bool IsPaymentSettled(PaymentStatus payment) => payment is PaymentStatus.Paid or PaymentStatus.Simulated;

    public static string Label(OrderStatus status) => status switch
    {
        OrderStatus.ReadyForDispatch => "Ready for dispatch",
        _ => status.ToString(),
    };
}
