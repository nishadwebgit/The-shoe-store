using FluentValidation;
using ShoeStore.Application.Dtos;

namespace ShoeStore.Application.Validation;

// Owner Portal request validation. Messages are written for a non-technical store owner.

public sealed class AdminProductRequestValidator : AbstractValidator<AdminProductRequest>
{
    private static readonly string[] Genders = ["men", "women", "kids", "unisex"];
    private static readonly string[] SizeSystems = ["adult", "kids"];
    private static readonly string[] Fits = ["true", "small", "large"];

    public AdminProductRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Enter the product name.").MaximumLength(150);
        RuleFor(x => x.Code).MaximumLength(20).Matches("^[A-Za-z0-9-]*$").WithMessage("Use letters, numbers and dashes only.");
        RuleFor(x => x).Must(x => x.BrandId is > 0 || !string.IsNullOrWhiteSpace(x.NewBrandName))
            .WithName("brandId").WithMessage("Choose a brand or add a new one.");
        RuleFor(x => x.NewBrandName).MaximumLength(80);
        RuleFor(x => x.Categories).NotEmpty().WithMessage("Choose at least one category.");
        RuleFor(x => x.Gender).Must(g => Genders.Contains(g?.Trim().ToLowerInvariant())).WithMessage("Choose who the shoe is for.");
        RuleFor(x => x.SizeSystem).Must(s => SizeSystems.Contains(s?.Trim().ToLowerInvariant())).WithMessage("Choose adult or kids sizing.");
        RuleFor(x => x.Fit).Must(f => Fits.Contains(f?.Trim().ToLowerInvariant())).WithMessage("Choose how the shoe fits.");
        RuleFor(x => x.Silhouette).NotEmpty().WithMessage("Choose the product type.").MaximumLength(30);
        RuleFor(x => x.Description).NotEmpty().WithMessage("Write a short description.").MaximumLength(2000);
        RuleFor(x => x.Materials).MaximumLength(1000);
        RuleFor(x => x.Care).MaximumLength(1000);
        RuleFor(x => x.RegularPrice).GreaterThan(0).WithMessage("Enter the regular price.").LessThan(10_000_000);
        RuleFor(x => x.SalePrice).GreaterThan(0).When(x => x.SalePrice is not null).WithMessage("The sale price must be more than zero.");
        RuleFor(x => x.SalePrice).LessThan(x => x.RegularPrice).When(x => x.SalePrice is not null)
            .WithMessage("The sale price must be lower than the regular price.");
        RuleForEach(x => x.Highlights).MaximumLength(200);
        RuleFor(x => x.Colours).NotEmpty().WithMessage("Add at least one colour.");
        RuleForEach(x => x.Colours).SetValidator(new AdminColourRequestValidator());
    }
}

public sealed class AdminColourRequestValidator : AbstractValidator<AdminColourRequest>
{
    public AdminColourRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name the colour, e.g. Black / White.").MaximumLength(80);
        RuleFor(x => x.Swatch).Matches("^#[0-9A-Fa-f]{6}$").WithMessage("Pick a swatch colour.");
        RuleFor(x => x.Family).NotEmpty().WithMessage("Choose the colour family used by the shop filter.").MaximumLength(20);
        RuleFor(x => x.Sizes).NotEmpty().WithMessage("Choose at least one size.");
        RuleFor(x => x.Images.Count).LessThanOrEqualTo(12).WithMessage("Use at most 12 images per colour.");
        RuleForEach(x => x.Images).ChildRules(i =>
        {
            i.RuleFor(x => x.Url).NotEmpty().MaximumLength(500);
            i.RuleFor(x => x.AltText).MaximumLength(200);
        });
    }
}

public sealed class AddColourRequestValidator : AbstractValidator<AddColourRequest>
{
    public AddColourRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Name the colour.").MaximumLength(80);
        RuleFor(x => x.Swatch).Matches("^#[0-9A-Fa-f]{6}$").WithMessage("Pick a swatch colour.");
        RuleFor(x => x.Family).NotEmpty().MaximumLength(20);
    }
}

public sealed class CreateStockReceiptRequestValidator : AbstractValidator<CreateStockReceiptRequest>
{
    public CreateStockReceiptRequestValidator()
    {
        RuleFor(x => x.ClientRequestId).NotEmpty();
        RuleFor(x => x.ProductId).GreaterThan(0).WithMessage("Choose the product you received.");
        RuleFor(x => x.SupplierName).MaximumLength(120);
        RuleFor(x => x.SupplierReference).MaximumLength(60);
        RuleFor(x => x.ReceivedDate).NotEmpty().WithMessage("Enter the date the stock arrived.");
        RuleFor(x => x.UnitCost).GreaterThanOrEqualTo(0).When(x => x.UnitCost is not null).WithMessage("The cost price can't be negative.");
        RuleFor(x => x.SellingPrice).GreaterThan(0).When(x => x.SellingPrice is not null).WithMessage("The selling price must be more than zero.");
        RuleFor(x => x.Notes).MaximumLength(500);
        RuleFor(x => x.Lines).NotEmpty().WithMessage("Enter a received quantity for at least one size.");
        RuleForEach(x => x.Lines).ChildRules(l =>
        {
            l.RuleFor(x => x.ColourId).GreaterThan(0);
            l.RuleFor(x => x.Size).NotEmpty().MaximumLength(8);
            l.RuleFor(x => x.Quantity).InclusiveBetween(0, 10_000).WithMessage("Quantities must be between 0 and 10,000.");
        });
    }
}

public sealed class AdjustStockRequestValidator : AbstractValidator<AdjustStockRequest>
{
    public AdjustStockRequestValidator()
    {
        RuleFor(x => x.Type).NotEmpty().WithMessage("Choose what kind of adjustment this is.");
        RuleFor(x => x.Change).NotEqual(0).WithMessage("Enter how many pairs to add or remove.").InclusiveBetween(-10_000, 10_000);
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Give a reason for this adjustment.").MinimumLength(3).MaximumLength(300);
    }
}

public sealed class SupplierRequestValidator : AbstractValidator<SupplierRequest>
{
    public SupplierRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Enter the supplier's name.").MaximumLength(120);
        RuleFor(x => x.ContactName).MaximumLength(80);
        RuleFor(x => x.Phone).MaximumLength(30);
        RuleFor(x => x.Email).MaximumLength(256).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email))
            .WithMessage("Enter an email address in the format name@example.com.");
        RuleFor(x => x.Notes).MaximumLength(500);
    }
}

public sealed class UpdateOrderStatusRequestValidator : AbstractValidator<UpdateOrderStatusRequest>
{
    public UpdateOrderStatusRequestValidator()
    {
        RuleFor(x => x.Status).NotEmpty().WithMessage("Choose the new status.");
        RuleFor(x => x.Note).MaximumLength(250);
    }
}
