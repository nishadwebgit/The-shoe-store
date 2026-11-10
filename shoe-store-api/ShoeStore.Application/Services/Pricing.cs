using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services;

public sealed record PricingLine(decimal UnitPrice, decimal? OriginalUnitPrice, int Quantity);

public sealed record PricingResult(
    int ItemCount,
    decimal Subtotal,
    decimal SaleSavings,
    decimal Discount,
    Coupon? AppliedCoupon,
    string? CouponError,
    decimal Shipping,
    decimal Total,
    decimal AmountToFreeShipping);

/// <summary>
/// Single source of truth for order maths. Amounts are LKR; percentage discounts are rounded
/// to the nearest rupee (half away from zero), matching the storefront.
/// </summary>
public static class PricingCalculator
{
    public static PricingResult Calculate(
        IReadOnlyCollection<PricingLine> lines,
        Coupon? coupon,
        string? couponError,
        ShippingMethod shippingMethod,
        decimal freeShippingThreshold)
    {
        var itemCount = lines.Sum(l => l.Quantity);
        var subtotal = lines.Sum(l => l.UnitPrice * l.Quantity);
        var saleSavings = lines.Sum(l => l.OriginalUnitPrice is { } original && original > l.UnitPrice
            ? (original - l.UnitPrice) * l.Quantity
            : 0m);

        Coupon? applied = couponError is null ? coupon : null;
        var discount = 0m;
        if (applied is not null && lines.Count > 0)
        {
            discount = applied.Type switch
            {
                CouponType.Percent => Math.Round(subtotal * applied.Value / 100m, 0, MidpointRounding.AwayFromZero),
                CouponType.Fixed => Math.Min(applied.Value, subtotal),
                _ => 0m,
            };
        }

        var afterDiscount = subtotal - discount;
        var shipping = lines.Count == 0 ? 0m : CalculateShipping(afterDiscount, shippingMethod, applied, freeShippingThreshold);
        var amountToFree = applied?.Type == CouponType.FreeShipping
            ? 0m
            : Math.Max(0m, freeShippingThreshold - afterDiscount);

        return new PricingResult(
            itemCount,
            subtotal,
            saleSavings,
            discount,
            applied,
            couponError,
            shipping,
            afterDiscount + shipping,
            amountToFree);
    }

    public static decimal CalculateShipping(decimal subtotalAfterDiscount, ShippingMethod method, Coupon? coupon, decimal freeShippingThreshold)
    {
        if (method.Fee <= 0) return 0m;
        if (method.FreeOverThreshold && coupon?.Type == CouponType.FreeShipping) return 0m;
        if (method.FreeOverThreshold && subtotalAfterDiscount >= freeShippingThreshold) return 0m;
        return method.Fee;
    }

    /// <summary>Checks whether a coupon can be used. Returns a shopper-facing error, or null when valid.</summary>
    public static string? ValidateCoupon(Coupon? coupon, string requestedCode, decimal subtotal, DateTime nowUtc)
    {
        var code = requestedCode.Trim().ToUpperInvariant();
        if (coupon is null || !coupon.IsActive)
            return $"\"{code}\" isn't a valid code. Check the spelling and try again.";
        if (coupon.StartsUtc is { } start && nowUtc < start)
            return $"{coupon.Code} isn't active yet.";
        if (coupon.EndsUtc is { } end && nowUtc > end)
            return $"{coupon.Code} has expired.";
        if (coupon.UsageLimit is { } limit && coupon.TimesUsed >= limit)
            return $"{coupon.Code} has reached its usage limit.";
        if (coupon.MinSubtotal is { } min && subtotal < min)
            return $"{coupon.Code} applies to orders over LKR {min:N0}.";
        return null;
    }
}

/// <summary>Delivery date estimates. Couriers work Monday to Saturday.</summary>
public static class DeliveryEstimator
{
    public static DateTime AddBusinessDays(DateTime fromUtc, int days)
    {
        var date = fromUtc;
        var added = 0;
        while (added < days)
        {
            date = date.AddDays(1);
            if (date.DayOfWeek != DayOfWeek.Sunday) added++;
        }
        return date;
    }

    public static (DateTime From, DateTime To) Estimate(ShippingMethod method, DateTime fromUtc) =>
        (AddBusinessDays(fromUtc, method.MinBusinessDays), AddBusinessDays(fromUtc, method.MaxBusinessDays));
}
