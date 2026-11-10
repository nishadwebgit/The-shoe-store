using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;
using ShoeStore.Infrastructure.Persistence;

namespace ShoeStore.Infrastructure.Seed;

/// <summary>
/// Seeds reference and catalogue data. Idempotent: rows are matched by their natural keys
/// (codes, names, SKUs) and only missing rows are inserted, so restarting the API never creates
/// duplicates or overwrites live data such as stock levels.
/// No customer accounts or passwords are seeded.
/// </summary>
public sealed class DbSeeder(AppDbContext db, ILogger<DbSeeder> logger)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public async Task SeedAsync(CancellationToken ct = default)
    {
        var data = await LoadSeedFileAsync(ct);

        await SeedSizesAsync(ct);
        await SeedCategoriesAsync(data, ct);
        await SeedBrandsAsync(data, ct);
        await SeedShippingMethodsAsync(ct);
        await SeedCouponsAsync(ct);
        await SeedProductsAsync(data, ct);
    }

    private static async Task<SeedFile> LoadSeedFileAsync(CancellationToken ct)
    {
        var assembly = typeof(DbSeeder).Assembly;
        var resource = assembly.GetManifestResourceNames().Single(n => n.EndsWith("catalog-seed.json", StringComparison.Ordinal));
        await using var stream = assembly.GetManifestResourceStream(resource)!;
        return await JsonSerializer.DeserializeAsync<SeedFile>(stream, JsonOptions, ct)
               ?? throw new InvalidOperationException("Seed file is empty.");
    }

    private async Task SeedSizesAsync(CancellationToken ct)
    {
        string[] kids = ["10K", "11K", "12K", "13K", "1K", "2K"];
        string[] adult = ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
        var existing = await db.Sizes.Select(s => s.Code).ToListAsync(ct);
        var order = 0;
        foreach (var code in kids.Concat(adult))
        {
            order++;
            if (existing.Contains(code)) continue;
            db.Sizes.Add(new Size
            {
                Code = code,
                Label = code.TrimEnd('K'),
                SizeSystem = code.EndsWith('K') ? SizeSystem.Kids : SizeSystem.Adult,
                SortOrder = order,
            });
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedCategoriesAsync(SeedFile data, CancellationToken ct)
    {
        var existing = await db.Categories.Select(c => c.Code).ToListAsync(ct);
        var order = 0;
        foreach (var c in data.Categories)
        {
            order++;
            if (existing.Contains(c.Code)) continue;
            db.Categories.Add(new Category { Code = c.Code, Name = c.Name, Description = c.Description, ImageUrl = c.Image, DisplayOrder = order });
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedBrandsAsync(SeedFile data, CancellationToken ct)
    {
        var existing = await db.Brands.Select(b => b.Name).ToListAsync(ct);
        foreach (var name in data.Products.Select(p => p.Brand).Distinct().Where(n => !existing.Contains(n)))
        {
            db.Brands.Add(new Brand
            {
                Name = name,
                Slug = Slugify(name),
                Description = name == "Nishoes" ? "Our own label, made with workshops in Sri Lanka." : null,
            });
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedShippingMethodsAsync(CancellationToken ct)
    {
        var existing = await db.ShippingMethods.Select(m => m.Code).ToListAsync(ct);
        var methods = new[]
        {
            new ShippingMethod { Code = "standard", Name = "Standard delivery", Description = "Island-wide courier", MinBusinessDays = 3, MaxBusinessDays = 5, Fee = 450, FreeOverThreshold = true, SortOrder = 1 },
            new ShippingMethod { Code = "express", Name = "Express delivery", Description = "Colombo, Gampaha and Kalutara districts", MinBusinessDays = 1, MaxBusinessDays = 2, Fee = 1200, FreeOverThreshold = false, RestrictedToDistricts = "Colombo,Gampaha,Kalutara", SortOrder = 2 },
            new ShippingMethod { Code = "pickup", Name = "Collect from the Ward Place store", Description = "Ready the next business day", MinBusinessDays = 1, MaxBusinessDays = 1, Fee = 0, FreeOverThreshold = false, SortOrder = 3 },
        };
        db.ShippingMethods.AddRange(methods.Where(m => !existing.Contains(m.Code)));
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedCouponsAsync(CancellationToken ct)
    {
        var existing = await db.Coupons.Select(c => c.Code).ToListAsync(ct);
        var coupons = new[]
        {
            new Coupon { Code = "NISHOES10", Description = "10% off your order", Type = CouponType.Percent, Value = 10 },
            new Coupon { Code = "WELCOME1500", Description = "LKR 1,500 off orders over LKR 15,000", Type = CouponType.Fixed, Value = 1500, MinSubtotal = 15000 },
            new Coupon { Code = "FREESHIP", Description = "Free standard delivery", Type = CouponType.FreeShipping, Value = 0 },
        };
        db.Coupons.AddRange(coupons.Where(c => !existing.Contains(c.Code)));
        await db.SaveChangesAsync(ct);
    }

    private async Task SeedProductsAsync(SeedFile data, CancellationToken ct)
    {
        // The demo catalogue is seeded once. After that the Owner Portal owns the catalogue, so products the
        // owner deletes are not re-created on the next start.
        var settings = await db.StoreSettings.FirstOrDefaultAsync(x => x.Id == 1, ct);
        if (settings is null)
        {
            settings = new StoreSettings { Id = 1 };
            db.StoreSettings.Add(settings);
        }
        if (settings.CatalogSeededUtc is not null) return;
        if (await db.Products.AnyAsync(ct))
        {
            settings.CatalogSeededUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Catalogue already present; demo product seeding is now switched off");
            return;
        }

        var existingCodes = await db.Products.Select(p => p.Code).ToListAsync(ct);
        var missing = data.Products.Where(p => !existingCodes.Contains(p.Code)).ToList();
        settings.CatalogSeededUtc = DateTime.UtcNow;
        if (missing.Count == 0)
        {
            await db.SaveChangesAsync(ct);
            return;
        }

        var brands = await db.Brands.ToDictionaryAsync(b => b.Name, ct);
        var categories = await db.Categories.ToDictionaryAsync(c => c.Code, ct);
        var sizes = await db.Sizes.ToDictionaryAsync(s => s.Code, ct);

        foreach (var p in missing)
        {
            var product = new Product
            {
                Code = p.Code,
                Slug = p.Slug,
                Name = p.Name,
                Brand = brands[p.Brand],
                Gender = ParseGender(p.Gender),
                SizeSystem = p.SizeSystem == "kids" ? SizeSystem.Kids : SizeSystem.Adult,
                Fit = p.Fit switch { "small" => FitType.RunsSmall, "large" => FitType.RunsLarge, _ => FitType.TrueToSize },
                Silhouette = p.Silhouette,
                Description = p.Description,
                Materials = p.Materials,
                Care = p.Care,
                Price = p.Price,
                OriginalPrice = p.OriginalPrice,
                Rating = p.Rating,
                ReviewCount = p.ReviewCount,
                IsFeatured = p.IsFeatured,
                IsNewArrival = p.IsNewArrival,
                IsBestSeller = p.IsBestSeller,
                ReleasedUtc = DateTime.SpecifyKind(DateTime.Parse(p.ReleasedAt, System.Globalization.CultureInfo.InvariantCulture), DateTimeKind.Utc),
                Popularity = p.Popularity,
            };

            foreach (var code in p.Categories)
                product.ProductCategories.Add(new ProductCategory { Product = product, Category = categories[code] });

            for (var i = 0; i < p.Highlights.Count; i++)
                product.Highlights.Add(new ProductHighlight { Text = p.Highlights[i], SortOrder = i });

            for (var i = 0; i < p.Specifications.Count; i++)
                product.Specifications.Add(new ProductSpecification { Label = p.Specifications[i].Label, Value = p.Specifications[i].Value, SortOrder = i });

            var colourEntities = new Dictionary<string, ProductColour>();
            for (var i = 0; i < p.Colours.Count; i++)
            {
                var c = p.Colours[i];
                var colour = new ProductColour { Product = product, Code = c.Code, Name = c.Name, SwatchHex = c.Swatch, Family = c.Family, SortOrder = i };
                for (var j = 0; j < c.Images.Count; j++)
                    colour.Images.Add(new ProductImage { Url = c.Images[j], AltText = $"{p.Name} in {c.Name}", SortOrder = j });
                product.Colours.Add(colour);
                colourEntities[c.Code] = colour;
            }

            foreach (var v in p.Variants)
            {
                product.Variants.Add(new ProductVariant
                {
                    Sku = v.Sku,
                    Product = product,
                    Colour = colourEntities[v.Colour],
                    Size = sizes[v.Size],
                    StockQuantity = v.Stock,
                });
            }

            foreach (var r in p.Reviews)
            {
                product.Reviews.Add(new ProductReview
                {
                    AuthorName = r.Author,
                    Location = r.Location,
                    Rating = r.Rating,
                    Title = r.Title,
                    Body = r.Body,
                    Fit = r.Fit switch { "small" => FitType.RunsSmall, "large" => FitType.RunsLarge, _ => FitType.TrueToSize },
                    SizePurchased = r.SizePurchased,
                    IsVerifiedPurchase = r.Verified,
                    CreatedUtc = r.CreatedAt.ToUniversalTime(),
                });
            }

            db.Products.Add(product);
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded {Count} products", missing.Count);
    }

    private static Gender ParseGender(string value) => value switch
    {
        "men" => Gender.Men,
        "women" => Gender.Women,
        "kids" => Gender.Kids,
        _ => Gender.Unisex,
    };

    private static string Slugify(string value)
    {
        var chars = value.ToLowerInvariant().Where(ch => ch != '\'' && ch != '’' && ch != '.')
            .Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray();
        var slug = new string(chars);
        while (slug.Contains("--", StringComparison.Ordinal)) slug = slug.Replace("--", "-", StringComparison.Ordinal);
        return slug.Trim('-');
    }

    // ---------------------------------------------------------------- seed file model

    private sealed class SeedFile
    {
        public List<SeedCategory> Categories { get; set; } = [];
        public List<SeedProduct> Products { get; set; } = [];
    }

    private sealed class SeedCategory
    {
        public string Code { get; set; } = "";
        public string Name { get; set; } = "";
        public string? Description { get; set; }
        public string? Image { get; set; }
    }

    private sealed class SeedProduct
    {
        public string Code { get; set; } = "";
        public string Slug { get; set; } = "";
        public string Name { get; set; } = "";
        public string Brand { get; set; } = "";
        public string Gender { get; set; } = "";
        public List<string> Categories { get; set; } = [];
        public string Silhouette { get; set; } = "";
        public string SizeSystem { get; set; } = "";
        public string Fit { get; set; } = "";
        public string Description { get; set; } = "";
        public List<string> Highlights { get; set; } = [];
        public string Materials { get; set; } = "";
        public string Care { get; set; } = "";
        public decimal Price { get; set; }
        public decimal? OriginalPrice { get; set; }
        public decimal Rating { get; set; }
        public int ReviewCount { get; set; }
        public bool IsFeatured { get; set; }
        public bool IsNewArrival { get; set; }
        public bool IsBestSeller { get; set; }
        public string ReleasedAt { get; set; } = "";
        public int Popularity { get; set; }
        public List<SeedSpec> Specifications { get; set; } = [];
        public List<SeedColour> Colours { get; set; } = [];
        public List<SeedVariant> Variants { get; set; } = [];
        public List<SeedReview> Reviews { get; set; } = [];
    }

    private sealed class SeedSpec
    {
        public string Label { get; set; } = "";
        public string Value { get; set; } = "";
    }

    private sealed class SeedColour
    {
        public string Code { get; set; } = "";
        public string Name { get; set; } = "";
        public string Swatch { get; set; } = "";
        public string Family { get; set; } = "";
        public List<string> Images { get; set; } = [];
    }

    private sealed class SeedVariant
    {
        public string Sku { get; set; } = "";
        public string Colour { get; set; } = "";
        public string Size { get; set; } = "";
        public int Stock { get; set; }
    }

    private sealed class SeedReview
    {
        public string Author { get; set; } = "";
        public string? Location { get; set; }
        public int Rating { get; set; }
        public string Title { get; set; } = "";
        public string Body { get; set; } = "";
        public string Fit { get; set; } = "";
        public string? SizePurchased { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool Verified { get; set; }
    }
}
