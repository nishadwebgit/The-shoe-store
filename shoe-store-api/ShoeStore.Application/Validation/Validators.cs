using FluentValidation;
using ShoeStore.Application.Dtos;

namespace ShoeStore.Application.Validation;

// Rules mirror the storefront's client-side validation (src/utils/validation.ts) so shoppers see the
// same messages either way. The server is the authority: the client checks are only a convenience.

internal static class Rules
{
    public const string PhonePattern = @"^(?:\+94|0)\d{9}$";
    public const string PostalCodePattern = @"^\d{5}$";

    public static IRuleBuilderOptions<T, string> ValidEmail<T>(this IRuleBuilder<T, string> rule) => rule
        .NotEmpty().WithMessage("Enter your email address.")
        .MaximumLength(256)
        .EmailAddress().WithMessage("Enter an email address in the format name@example.com.");

    public static IRuleBuilderOptions<T, string> StrongPassword<T>(this IRuleBuilder<T, string> rule) => rule
        .NotEmpty().WithMessage("Enter a password.")
        .MinimumLength(8).WithMessage("Use at least 8 characters.")
        .MaximumLength(128)
        .Matches("[A-Za-z]").WithMessage("Include at least one letter and one number.")
        .Matches("[0-9]").WithMessage("Include at least one letter and one number.");

    public static IRuleBuilderOptions<T, string> SriLankanPhone<T>(this IRuleBuilder<T, string> rule) => rule
        .NotEmpty().WithMessage("Enter a phone number so the courier can reach you.")
        .Must(p => System.Text.RegularExpressions.Regex.IsMatch(p.Replace(" ", "").Replace("-", ""), PhonePattern))
        .WithMessage("Enter a Sri Lankan number, e.g. 077 123 4567.");

    public static IRuleBuilderOptions<T, string> Required<T>(this IRuleBuilder<T, string> rule, string label, int max = 100) => rule
        .NotEmpty().WithMessage($"Enter your {label}.")
        .MaximumLength(max).WithMessage($"Your {label} can be at most {max} characters.");
}

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.FirstName).Required("first name", 60);
        RuleFor(x => x.LastName).Required("last name", 60);
        RuleFor(x => x.Email).ValidEmail();
        RuleFor(x => x.Password).StrongPassword();
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).ValidEmail();
        RuleFor(x => x.Password).NotEmpty().WithMessage("Enter your password.").MaximumLength(128);
    }
}

public sealed class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty().WithMessage("Enter your current password.");
        RuleFor(x => x.NewPassword).StrongPassword()
            .NotEqual(x => x.CurrentPassword).WithMessage("Choose a password you haven't used for this account.");
    }
}

public sealed class UpdateProfileRequestValidator : AbstractValidator<UpdateProfileRequest>
{
    public UpdateProfileRequestValidator()
    {
        RuleFor(x => x.FirstName).Required("first name", 60);
        RuleFor(x => x.LastName).Required("last name", 60);
        RuleFor(x => x.Phone!).SriLankanPhone().When(x => !string.IsNullOrWhiteSpace(x.Phone));
        RuleFor(x => x.PreferredSize).MaximumLength(8);
    }
}

public sealed class AddressRequestValidator : AbstractValidator<AddressRequest>
{
    public AddressRequestValidator()
    {
        RuleFor(x => x.FirstName).Required("first name", 60);
        RuleFor(x => x.LastName).Required("last name", 60);
        RuleFor(x => x.Line1).Required("street address", 150);
        RuleFor(x => x.Line2).MaximumLength(150);
        RuleFor(x => x.City).Required("town or city", 80);
        RuleFor(x => x.District).NotEmpty().WithMessage("Select your district.").MaximumLength(40);
        RuleFor(x => x.PostalCode).NotEmpty().WithMessage("Enter your postal code.")
            .Matches(Rules.PostalCodePattern).WithMessage("Postal codes in Sri Lanka have 5 digits, e.g. 00700.");
        RuleFor(x => x.Phone).SriLankanPhone();
    }
}

public sealed class CheckoutAddressRequestValidator : AbstractValidator<CheckoutAddressRequest>
{
    public CheckoutAddressRequestValidator()
    {
        RuleFor(x => x.FirstName).Required("first name", 60);
        RuleFor(x => x.LastName).Required("last name", 60);
        RuleFor(x => x.Line1).Required("street address", 150);
        RuleFor(x => x.Line2).MaximumLength(150);
        RuleFor(x => x.City).Required("town or city", 80);
        RuleFor(x => x.District).NotEmpty().WithMessage("Select your district.").MaximumLength(40);
        RuleFor(x => x.PostalCode).NotEmpty().WithMessage("Enter your postal code.")
            .Matches(Rules.PostalCodePattern).WithMessage("Postal codes in Sri Lanka have 5 digits, e.g. 00700.");
        RuleFor(x => x.Phone).SriLankanPhone();
    }
}

public sealed class CheckoutRequestValidator : AbstractValidator<CheckoutRequest>
{
    public CheckoutRequestValidator()
    {
        RuleFor(x => x.Email).ValidEmail();
        RuleFor(x => x.ShippingAddress).NotNull().WithMessage("Enter a delivery address.")
            .SetValidator(new CheckoutAddressRequestValidator());
        RuleFor(x => x.DeliveryMethod).NotEmpty().WithMessage("Choose a delivery option.").MaximumLength(20);
        RuleFor(x => x.CouponCode).MaximumLength(40);
        RuleFor(x => x.PaymentMethod).MaximumLength(20);
    }
}

public sealed class StartPayHereCheckoutRequestValidator : AbstractValidator<StartPayHereCheckoutRequest>
{
    public StartPayHereCheckoutRequestValidator()
    {
        RuleFor(x => x.OrderNumber).NotEmpty().WithMessage("Enter the order number.").MaximumLength(20);
        RuleFor(x => x.Email).MaximumLength(256);
    }
}

public sealed class CheckoutQuoteRequestValidator : AbstractValidator<CheckoutQuoteRequest>
{
    public CheckoutQuoteRequestValidator()
    {
        RuleFor(x => x.DeliveryMethod).NotEmpty().WithMessage("Choose a delivery option.").MaximumLength(20);
        RuleFor(x => x.CouponCode).MaximumLength(40);
        RuleFor(x => x.District).MaximumLength(40);
    }
}

public sealed class AddCartItemRequestValidator : AbstractValidator<AddCartItemRequest>
{
    public AddCartItemRequestValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty().WithMessage("Choose a product.").MaximumLength(20);
        RuleFor(x => x.ColourId).NotEmpty().WithMessage("Select a colour before adding to your bag.").MaximumLength(40);
        RuleFor(x => x.Size).NotEmpty().WithMessage("Select a size before adding to your bag.").MaximumLength(8);
        RuleFor(x => x.Quantity).InclusiveBetween(1, 10).WithMessage("Choose a quantity between 1 and 10.");
    }
}

public sealed class UpdateCartItemRequestValidator : AbstractValidator<UpdateCartItemRequest>
{
    public UpdateCartItemRequestValidator()
    {
        RuleFor(x => x.Quantity).InclusiveBetween(1, 10)
            .WithMessage("Quantity must be between 1 and 10. Use Remove to take an item out of your bag.");
    }
}

public sealed class ApplyCouponRequestValidator : AbstractValidator<ApplyCouponRequest>
{
    public ApplyCouponRequestValidator()
    {
        RuleFor(x => x.Code).NotEmpty().WithMessage("Enter a discount code.").MaximumLength(40);
    }
}

public sealed class AddWishlistItemRequestValidator : AbstractValidator<AddWishlistItemRequest>
{
    public AddWishlistItemRequestValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty().WithMessage("Choose a product.").MaximumLength(20);
    }
}

public sealed class MergeWishlistRequestValidator : AbstractValidator<MergeWishlistRequest>
{
    public MergeWishlistRequestValidator()
    {
        RuleFor(x => x.ProductIds).NotNull().Must(ids => ids.Count <= 200).WithMessage("Send at most 200 products at once.");
    }
}

public sealed class StockCheckRequestValidator : AbstractValidator<StockCheckRequest>
{
    public StockCheckRequestValidator()
    {
        RuleFor(x => x.Skus).NotNull().Must(s => s.Count is > 0 and <= 100).WithMessage("Send between 1 and 100 SKUs.");
    }
}

public sealed class ProductQueryParametersValidator : AbstractValidator<ProductQueryParameters>
{
    public ProductQueryParametersValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1).WithMessage("Page must be 1 or more.");
        RuleFor(x => x.PageSize).InclusiveBetween(1, 48).WithMessage("Page size must be between 1 and 48.");
        RuleFor(x => x.MinPrice).GreaterThanOrEqualTo(0).When(x => x.MinPrice.HasValue);
        RuleFor(x => x.MaxPrice).GreaterThanOrEqualTo(0).When(x => x.MaxPrice.HasValue);
        RuleFor(x => x).Must(x => x.MinPrice is null || x.MaxPrice is null || x.MinPrice <= x.MaxPrice)
            .WithName("MinPrice").WithMessage("The minimum price must be lower than the maximum.");
        RuleFor(x => x.MinRating).InclusiveBetween(0, 5).When(x => x.MinRating.HasValue);
        RuleFor(x => x.Search).MaximumLength(100);
        RuleFor(x => x.Sort).Must(s => s is null || new[] { "featured", "newest", "popular", "price-asc", "price-desc", "rating" }.Contains(s))
            .WithMessage("Sort must be featured, newest, popular, price-asc, price-desc or rating.");
    }
}
