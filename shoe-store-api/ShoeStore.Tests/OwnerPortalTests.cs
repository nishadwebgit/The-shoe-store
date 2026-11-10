using ShoeStore.Application.Options;
using ShoeStore.Application.Services;
using ShoeStore.Application.Services.Admin;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Tests;

public class OrderWorkflowTests
{
    [Theory]
    [InlineData(OrderStatus.Pending, OrderStatus.Confirmed)]
    [InlineData(OrderStatus.Confirmed, OrderStatus.Processing)]
    [InlineData(OrderStatus.Processing, OrderStatus.ReadyForDispatch)]
    [InlineData(OrderStatus.ReadyForDispatch, OrderStatus.Shipped)]
    [InlineData(OrderStatus.Shipped, OrderStatus.Delivered)]
    public void Orders_move_one_step_at_a_time(OrderStatus from, OrderStatus to)
    {
        Assert.Contains(to, OrderWorkflow.AllowedTransitions(from));
        Assert.Equal(to, OrderWorkflow.Next(from));
    }

    [Theory]
    [InlineData(OrderStatus.Pending, true)]
    [InlineData(OrderStatus.ReadyForDispatch, true)]
    [InlineData(OrderStatus.Shipped, false)]
    [InlineData(OrderStatus.Delivered, false)]
    [InlineData(OrderStatus.Cancelled, false)]
    public void Only_orders_that_have_not_left_can_be_cancelled(OrderStatus status, bool cancellable) =>
        Assert.Equal(cancellable, OrderWorkflow.AllowedTransitions(status).Contains(OrderStatus.Cancelled));

    [Fact]
    public void Steps_cannot_be_skipped_or_reversed()
    {
        Assert.DoesNotContain(OrderStatus.Shipped, OrderWorkflow.AllowedTransitions(OrderStatus.Pending));
        Assert.DoesNotContain(OrderStatus.Pending, OrderWorkflow.AllowedTransitions(OrderStatus.Confirmed));
        Assert.Empty(OrderWorkflow.AllowedTransitions(OrderStatus.Delivered));
    }

    [Theory]
    [InlineData(OrderStatus.Confirmed, false)]
    [InlineData(OrderStatus.Processing, false)]
    [InlineData(OrderStatus.ReadyForDispatch, true)]
    [InlineData(OrderStatus.Shipped, true)]
    public void Dispatch_steps_require_payment(OrderStatus target, bool requiresPayment) =>
        Assert.Equal(requiresPayment, OrderWorkflow.RequiresPayment(target));

    [Theory]
    [InlineData(PaymentStatus.Paid, true)]
    [InlineData(PaymentStatus.Simulated, true)]
    [InlineData(PaymentStatus.Pending, false)]
    [InlineData(PaymentStatus.Failed, false)]
    [InlineData(PaymentStatus.Refunded, false)]
    public void Payment_settlement(PaymentStatus payment, bool settled) =>
        Assert.Equal(settled, OrderWorkflow.IsPaymentSettled(payment));

    [Theory]
    [InlineData("ready-for-dispatch", OrderStatus.ReadyForDispatch)]
    [InlineData("Pending", OrderStatus.Pending)]
    [InlineData("canceled", OrderStatus.Cancelled)]
    public void Status_strings_round_trip(string text, OrderStatus expected)
    {
        Assert.Equal(expected, ApiValues.ParseOrderStatus(text));
        Assert.Equal(expected, ApiValues.ParseOrderStatus(expected.ToApi()));
    }
}

public class InventoryRulesTests
{
    [Theory]
    [InlineData(0, 3, "out")]
    [InlineData(-1, 3, "out")]
    [InlineData(1, 3, "low")]
    [InlineData(3, 3, "low")]
    [InlineData(4, 3, "in")]
    [InlineData(1, 0, "in")]
    public void Stock_state_uses_threshold(int quantity, int threshold, string expected) =>
        Assert.Equal(expected, StockState.Of(quantity, threshold));

    [Theory]
    [InlineData("Nike Air Max 90", "nike-air-max-90")]
    [InlineData("  Black / White ", "black-white")]
    [InlineData("Nike Air Force 1 ’07", "nike-air-force-1-07")]
    [InlineData("Café Crème", "cafe-creme")]
    public void Slugs_are_url_safe(string input, string expected) =>
        Assert.Equal(expected, AdminProductService.Slugify(input));

    [Fact]
    public void Owner_role_comes_from_configured_emails()
    {
        var options = new AdminOptions { OwnerEmails = ["Owner@Nishoes.lk"] };
        Assert.Equal(CustomerRole.Admin, OwnerAccounts.RoleFor(" owner@nishoes.lk ", options));
        Assert.Equal(CustomerRole.Customer, OwnerAccounts.RoleFor("someone@else.lk", options));
        Assert.Equal(CustomerRole.Customer, OwnerAccounts.RoleFor("owner@nishoes.lk", new AdminOptions()));
    }
}
