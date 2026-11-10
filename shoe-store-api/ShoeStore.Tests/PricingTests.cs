using FluentValidation.TestHelper;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Services;
using ShoeStore.Application.Validation;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;
using ShoeStore.Infrastructure.Security;

namespace ShoeStore.Tests;

public class PricingCalculatorTests
{
    private const decimal Threshold = 25000m;

    private static readonly ShippingMethod Standard = new() { Code = "standard", Name = "Standard", Fee = 450, FreeOverThreshold = true };
    private static readonly ShippingMethod Express = new() { Code = "express", Name = "Express", Fee = 1200, FreeOverThreshold = false };
    private static readonly ShippingMethod Pickup = new() { Code = "pickup", Name = "Pickup", Fee = 0 };

    private static Coupon Percent(decimal value) => new() { Code = "NISHOES10", Type = CouponType.Percent, Value = value, IsActive = true };
    private static Coupon Fixed(decimal value, decimal? min = null) => new() { Code = "WELCOME1500", Type = CouponType.Fixed, Value = value, MinSubtotal = min, IsActive = true };
    private static Coupon FreeShip() => new() { Code = "FREESHIP", Type = CouponType.FreeShipping, IsActive = true };

    [Fact]
    public void Subtotal_and_item_count_sum_all_lines()
    {
        var result = PricingCalculator.Calculate(
            [new PricingLine(10000, null, 2), new PricingLine(4500, 5000, 1)], null, null, Standard, Threshold);

        Assert.Equal(3, result.ItemCount);
        Assert.Equal(24500m, result.Subtotal);
        Assert.Equal(500m, result.SaleSavings);
        Assert.Equal(450m, result.Shipping);
        Assert.Equal(24950m, result.Total);
        Assert.Equal(500m, result.AmountToFreeShipping);
    }

    [Fact]
    public void Standard_delivery_is_free_at_the_threshold()
    {
        var result = PricingCalculator.Calculate([new PricingLine(25000, null, 1)], null, null, Standard, Threshold);
        Assert.Equal(0m, result.Shipping);
        Assert.Equal(25000m, result.Total);
    }

    [Fact]
    public void Express_is_never_free_by_threshold_and_pickup_is_always_free()
    {
        var lines = new[] { new PricingLine(40000, null, 1) };
        Assert.Equal(1200m, PricingCalculator.Calculate(lines, null, null, Express, Threshold).Shipping);
        Assert.Equal(0m, PricingCalculator.Calculate(lines, null, null, Pickup, Threshold).Shipping);
    }

    [Fact]
    public void Percent_discount_rounds_to_the_nearest_rupee_and_applies_before_threshold()
    {
        // 26,995 * 10% = 2,699.5 → 2,700; 24,295 after discount is under the threshold, so delivery is charged.
        var result = PricingCalculator.Calculate([new PricingLine(26995, null, 1)], Percent(10), null, Standard, Threshold);
        Assert.Equal(2700m, result.Discount);
        Assert.Equal(450m, result.Shipping);
        Assert.Equal(26995m - 2700m + 450m, result.Total);
    }

    [Fact]
    public void Fixed_discount_never_exceeds_the_subtotal()
    {
        var result = PricingCalculator.Calculate([new PricingLine(1000, null, 1)], Fixed(1500), null, Pickup, Threshold);
        Assert.Equal(1000m, result.Discount);
        Assert.Equal(0m, result.Total);
    }

    [Fact]
    public void Free_shipping_coupon_only_affects_eligible_methods()
    {
        var lines = new[] { new PricingLine(5000, null, 1) };
        Assert.Equal(0m, PricingCalculator.Calculate(lines, FreeShip(), null, Standard, Threshold).Shipping);
        Assert.Equal(1200m, PricingCalculator.Calculate(lines, FreeShip(), null, Express, Threshold).Shipping);
    }

    [Fact]
    public void Invalid_coupon_is_ignored_in_totals()
    {
        var result = PricingCalculator.Calculate([new PricingLine(5000, null, 1)], Percent(10), "invalid", Standard, Threshold);
        Assert.Equal(0m, result.Discount);
        Assert.Null(result.AppliedCoupon);
        Assert.Equal("invalid", result.CouponError);
    }

    [Fact]
    public void Empty_cart_has_no_shipping_and_zero_total()
    {
        var result = PricingCalculator.Calculate([], Percent(10), null, Standard, Threshold);
        Assert.Equal(0m, result.Total);
        Assert.Equal(0m, result.Shipping);
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData(14999, false)]
    [InlineData(15000, true)]
    public void Coupon_minimum_subtotal_is_enforced(int? subtotal, bool valid)
    {
        var error = PricingCalculator.ValidateCoupon(Fixed(1500, 15000), "welcome1500", subtotal ?? 0, DateTime.UtcNow);
        Assert.Equal(valid, error is null);
    }

    [Fact]
    public void Unknown_inactive_expired_and_exhausted_coupons_are_rejected()
    {
        var now = DateTime.UtcNow;
        Assert.NotNull(PricingCalculator.ValidateCoupon(null, "nope", 1000, now));
        Assert.NotNull(PricingCalculator.ValidateCoupon(new Coupon { Code = "X", IsActive = false }, "x", 1000, now));
        Assert.NotNull(PricingCalculator.ValidateCoupon(new Coupon { Code = "X", IsActive = true, EndsUtc = now.AddDays(-1) }, "x", 1000, now));
        Assert.NotNull(PricingCalculator.ValidateCoupon(new Coupon { Code = "X", IsActive = true, UsageLimit = 5, TimesUsed = 5 }, "x", 1000, now));
    }

    [Fact]
    public void Business_days_skip_sundays()
    {
        var saturday = new DateTime(2026, 11, 7, 10, 0, 0, DateTimeKind.Utc);
        Assert.Equal(DayOfWeek.Saturday, saturday.DayOfWeek);
        Assert.Equal(new DateTime(2026, 11, 9, 10, 0, 0, DateTimeKind.Utc), DeliveryEstimator.AddBusinessDays(saturday, 1));
    }

    [Fact]
    public void Shipping_method_district_restriction()
    {
        var express = new ShippingMethod { RestrictedToDistricts = "Colombo,Gampaha,Kalutara" };
        Assert.True(express.ServesDistrict("colombo"));
        Assert.False(express.ServesDistrict("Kandy"));
        Assert.True(new ShippingMethod().ServesDistrict("Jaffna"));
    }
}

public class SecurityAndValidationTests
{
    [Fact]
    public void Passwords_are_hashed_and_verified()
    {
        var service = new PasswordService();
        var customer = new Customer { Id = Guid.NewGuid(), Email = "a@b.lk" };
        customer.PasswordHash = service.Hash(customer, "Running2026");

        Assert.DoesNotContain("Running2026", customer.PasswordHash);
        Assert.True(service.Verify(customer, "Running2026", out _));
        Assert.False(service.Verify(customer, "running2026", out _));
    }

    [Fact]
    public void Register_validator_rejects_weak_passwords_and_bad_emails()
    {
        var validator = new RegisterRequestValidator();
        var result = validator.TestValidate(new RegisterRequest("", "Silva", "not-an-email", "short", false));
        result.ShouldHaveValidationErrorFor(x => x.FirstName);
        result.ShouldHaveValidationErrorFor(x => x.Email);
        result.ShouldHaveValidationErrorFor(x => x.Password);

        validator.TestValidate(new RegisterRequest("Ishara", "Silva", "ishara@example.com", "Running2026", true))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("077 123 4567", "00700", true)]
    [InlineData("+94771234567", "20000", true)]
    [InlineData("12345", "00700", false)]
    [InlineData("0771234567", "700", false)]
    public void Checkout_address_validation_matches_storefront_rules(string phone, string postcode, bool valid)
    {
        var request = new CheckoutRequest(
            "kasun@example.com",
            new CheckoutAddressRequest("Kasun", "Perera", "25 Temple Road", null, "Kandy", "Kandy", postcode, phone),
            "standard",
            null);
        var result = new CheckoutRequestValidator().TestValidate(request);
        Assert.Equal(valid, result.IsValid);
    }

    [Fact]
    public void Cart_quantity_must_be_between_1_and_10()
    {
        var validator = new AddCartItemRequestValidator();
        Assert.False(validator.Validate(new AddCartItemRequest("P001", "white", "8", 0)).IsValid);
        Assert.False(validator.Validate(new AddCartItemRequest("P001", "white", "8", 11)).IsValid);
        Assert.True(validator.Validate(new AddCartItemRequest("P001", "white", "8", 2)).IsValid);
    }
}
