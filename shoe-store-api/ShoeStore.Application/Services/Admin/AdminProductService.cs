using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services.Admin;

public interface IAdminProductService
{
    Task<AdminLookupsDto> GetLookupsAsync(CancellationToken ct);
    Task<PagedResult<AdminProductListItemDto>> ListAsync(AdminProductQuery query, CancellationToken ct);
    Task<AdminProductDto> GetAsync(int id, CancellationToken ct);
    Task<AdminProductDto> CreateAsync(AdminProductRequest request, CancellationToken ct);
    Task<AdminProductDto> UpdateAsync(int id, AdminProductRequest request, CancellationToken ct);
    Task<AdminProductDto> SetStatusAsync(int id, AdminProductStatusRequest request, CancellationToken ct);
    Task<AdminProductDto> AddColourAsync(int id, AddColourRequest request, CancellationToken ct);
    Task DeleteAsync(int id, CancellationToken ct);
}

/// <summary>
/// Product catalogue management for the Owner Portal. Stock is deliberately not editable here:
/// it only changes through stock receipts and audited adjustments (see <see cref="IInventoryLedger"/>).
/// </summary>
public sealed partial class AdminProductService(
    IAppDbContext db,
    IAdminContext admin,
    IFileStorage storage,
    IClock clock,
    ILogger<AdminProductService> logger) : IAdminProductService
{
    private static readonly string[] DefaultSilhouettes = ["runner", "court", "trainer", "trail", "boot", "sandal", "slip-on", "skate", "formal"];

    // ------------------------------------------------------------------ Lookups

    public async Task<AdminLookupsDto> GetLookupsAsync(CancellationToken ct)
    {
        var settings = await admin.GetSettingsAsync(ct);
        var brands = await db.Brands.AsNoTracking().OrderBy(b => b.Name).Select(b => new IdNameDto(b.Id, b.Name)).ToListAsync(ct);
        var categories = await db.Categories.AsNoTracking().OrderBy(c => c.DisplayOrder).Select(c => new CodeNameDto(c.Code, c.Name)).ToListAsync(ct);
        var sizes = await db.Sizes.AsNoTracking().OrderBy(s => s.SortOrder).ToListAsync(ct);
        var suppliers = await db.Suppliers.AsNoTracking().Where(s => s.IsActive).OrderBy(s => s.Name)
            .Select(s => new IdNameDto(s.Id, s.Name)).ToListAsync(ct);
        var silhouettes = await db.Products.AsNoTracking().Select(p => p.Silhouette).Distinct().ToListAsync(ct);

        return new AdminLookupsDto(
            brands,
            categories,
            sizes.Select(s => new AdminSizeDto(s.Code, s.Label, s.SizeSystem.ToApi())).ToList(),
            ApiValues.ColourFamilies.Select(f => new ColourFamilyDto(f.Value, f.Label, f.Swatch)).ToList(),
            suppliers,
            silhouettes.Concat(DefaultSilhouettes).Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => s.Trim().ToLowerInvariant()).Distinct().Order().ToList(),
            settings.LowStockThreshold,
            await NextCodeAsync(ct));
    }

    // ------------------------------------------------------------------ List

    public async Task<PagedResult<AdminProductListItemDto>> ListAsync(AdminProductQuery q, CancellationToken ct)
    {
        var (page, pageSize) = AdminMapping.Paging(q.Page, q.PageSize);
        var threshold = (await admin.GetSettingsAsync(ct)).LowStockThreshold;
        var query = db.Products.AsNoTracking().AsQueryable();

        if (AdminMapping.NullIfEmpty(q.Search) is { } search)
        {
            query = query.Where(p =>
                p.Name.Contains(search) || p.Code.Contains(search) || p.Brand.Name.Contains(search) ||
                p.ProductCategories.Any(pc => pc.Category.Name.Contains(search) || pc.Category.Code.Contains(search)) ||
                p.Variants.Any(v => v.Sku.Contains(search)));
        }
        if (q.BrandId is { } brandId) query = query.Where(p => p.BrandId == brandId);
        if (AdminMapping.NullIfEmpty(q.Category) is { } category)
            query = query.Where(p => p.ProductCategories.Any(pc => pc.Category.Code == category));
        query = q.Status?.Trim().ToLowerInvariant() switch
        {
            "active" => query.Where(p => p.IsActive),
            "inactive" => query.Where(p => !p.IsActive),
            _ => query,
        };
        query = q.Stock?.Trim().ToLowerInvariant() switch
        {
            StockState.In => query.Where(p => p.Variants.Any(v => v.StockQuantity > 0)),
            StockState.Out => query.Where(p => !p.Variants.Any(v => v.StockQuantity > 0)),
            StockState.Low => query.Where(p => p.Variants.Any(v => v.StockQuantity > 0 && v.StockQuantity <= (v.LowStockThreshold ?? threshold))),
            _ => query,
        };

        query = q.Sort?.Trim().ToLowerInvariant() switch
        {
            "name" => query.OrderBy(p => p.Name),
            "code" => query.OrderBy(p => p.Code),
            "price" => query.OrderBy(p => p.Price),
            "stock" => query.OrderBy(p => p.Variants.Sum(v => v.StockQuantity)),
            _ => query.OrderByDescending(p => p.ModifiedUtc ?? p.CreatedUtc).ThenBy(p => p.Code),
        };

        var total = await query.CountAsync(ct);
        var rows = await query
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(p => new
            {
                p.Id,
                p.Code,
                p.Slug,
                p.Name,
                Brand = p.Brand.Name,
                Categories = p.ProductCategories.OrderBy(pc => pc.Category.DisplayOrder).Select(pc => pc.Category.Name).ToList(),
                p.Gender,
                p.Price,
                p.OriginalPrice,
                Image = p.Colours.OrderBy(c => c.SortOrder)
                    .Select(c => c.Images.OrderBy(i => i.SortOrder).Select(i => i.Url).FirstOrDefault())
                    .FirstOrDefault(),
                TotalStock = p.Variants.Sum(v => v.StockQuantity),
                VariantCount = p.Variants.Count,
                Low = p.Variants.Count(v => v.StockQuantity > 0 && v.StockQuantity <= (v.LowStockThreshold ?? threshold)),
                Out = p.Variants.Count(v => v.StockQuantity <= 0),
                p.IsActive,
                p.IsFeatured,
                p.CreatedUtc,
                p.ModifiedUtc,
            })
            .ToListAsync(ct);

        var items = rows.Select(p => new AdminProductListItemDto(
            p.Id, p.Code, p.Slug, p.Name, p.Brand, p.Categories, p.Gender.ToApi(), p.Price, p.OriginalPrice, p.Image,
            p.TotalStock, p.VariantCount, p.Low, p.Out, p.IsActive, p.IsFeatured, p.CreatedUtc, p.ModifiedUtc)).ToList();

        return PagedResult<AdminProductListItemDto>.Create(items, page, pageSize, total);
    }

    // ------------------------------------------------------------------ Detail

    public async Task<AdminProductDto> GetAsync(int id, CancellationToken ct)
    {
        var product = await LoadAsync(id, tracking: false, ct);
        return await ToDtoAsync(product, ct);
    }

    private async Task<Product> LoadAsync(int id, bool tracking, CancellationToken ct)
    {
        var query = db.Products
            .AsSplitQuery()
            .Include(p => p.Brand)
            .Include(p => p.ProductCategories).ThenInclude(pc => pc.Category)
            .Include(p => p.Colours).ThenInclude(c => c.Images)
            .Include(p => p.Variants).ThenInclude(v => v.Size)
            .Include(p => p.Highlights)
            .AsQueryable();
        if (!tracking) query = query.AsNoTracking();
        return await query.FirstOrDefaultAsync(p => p.Id == id, ct)
               ?? throw new NotFoundException("That product doesn't exist. It may have been deleted.", "product_not_found");
    }

    private async Task<AdminProductDto> ToDtoAsync(Product p, CancellationToken ct)
    {
        var threshold = (await admin.GetSettingsAsync(ct)).LowStockThreshold;
        var entityId = p.Id.ToString(CultureInfo.InvariantCulture);
        var audit = await db.AdminAuditLogs.AsNoTracking()
            .Where(a => a.EntityType == "product" && a.EntityId == entityId)
            .OrderBy(a => a.Id)
            .Select(a => new { a.Action, a.PerformedByName })
            .ToListAsync(ct);
        var createdBy = audit.FirstOrDefault(a => a.Action == "product.created")?.PerformedByName;
        var updatedBy = audit.LastOrDefault()?.PerformedByName;

        var (canDelete, reason) = await DeleteCheckAsync(p, ct);
        var colours = p.Colours.OrderBy(c => c.SortOrder).ToList();
        var (regular, sale) = p.OriginalPrice is { } original && original > p.Price ? (original, (decimal?)p.Price) : (p.Price, null);

        return new AdminProductDto(
            p.Id,
            p.Code,
            p.Slug,
            p.Name,
            p.BrandId,
            p.Brand.Name,
            p.ProductCategories.OrderBy(pc => pc.Category.DisplayOrder).Select(pc => pc.Category.Code).ToList(),
            p.Gender.ToApi(),
            p.SizeSystem.ToApi(),
            p.Fit.ToApi(),
            p.Silhouette,
            p.Description,
            p.Materials,
            p.Care,
            regular,
            sale,
            p.IsActive,
            p.IsFeatured,
            p.IsNewArrival,
            p.Highlights.OrderBy(h => h.SortOrder).Select(h => h.Text).ToList(),
            colours.Select(c => new AdminColourDto(
                c.Id, c.Code, c.Name, c.SwatchHex, c.Family,
                c.Images.OrderBy(i => i.SortOrder).Select(i => new AdminImageDto(i.Id, i.Url, i.AltText, i.SortOrder)).ToList())).ToList(),
            p.Variants
                .OrderBy(v => colours.FindIndex(c => c.Id == v.ProductColourId))
                .ThenBy(v => v.Size.SortOrder)
                .Select(v =>
                {
                    var effective = v.LowStockThreshold ?? threshold;
                    var colour = colours.First(c => c.Id == v.ProductColourId);
                    return new AdminVariantDto(v.Id, v.Sku, colour.Id, colour.Name, v.Size.Code, v.Size.Label, v.StockQuantity,
                        v.LowStockThreshold, effective, StockState.Of(v.StockQuantity, effective), v.ModifiedUtc ?? v.CreatedUtc);
                })
                .ToList(),
            p.Variants.Sum(v => v.StockQuantity),
            p.CreatedUtc,
            p.ModifiedUtc,
            createdBy,
            updatedBy,
            canDelete,
            reason);
    }

    private async Task<(bool CanDelete, string? Reason)> DeleteCheckAsync(Product p, CancellationToken ct)
    {
        if (p.Variants.Any(v => v.StockQuantity > 0))
            return (false, "This product still has stock. Deactivate it instead, or adjust the stock to zero first.");
        if (await db.OrderItems.AnyAsync(i => i.ProductCode == p.Code, ct))
            return (false, "Customers have ordered this product. Deactivate it instead so order history stays linked to it.");
        return (true, null);
    }

    // ------------------------------------------------------------------ Create / update

    public async Task<AdminProductDto> CreateAsync(AdminProductRequest request, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);
        var code = AdminMapping.NullIfEmpty(request.Code)?.ToUpperInvariant() ?? await NextCodeAsync(ct);
        if (await db.Products.AnyAsync(p => p.Code == code, ct))
            throw new ConflictException($"Product code {code} is already used. Choose another code.", "duplicate_product_code");

        var product = new Product
        {
            Code = code,
            ReleasedUtc = clock.UtcNow,
            Rating = 0,
            ReviewCount = 0,
            Popularity = 0,
        };
        await ApplyAsync(product, request, isNew: true, ct);
        db.Products.Add(product);

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.SaveChangesAsync(ct);
        admin.Audit(actor, "product.created", "product", product.Id.ToString(CultureInfo.InvariantCulture), $"Created {product.Code} {product.Name}");
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        logger.LogInformation("Product {Code} created by {Actor}", product.Code, actor.Name);
        return await GetAsync(product.Id, ct);
    }

    public async Task<AdminProductDto> UpdateAsync(int id, AdminProductRequest request, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);
        var product = await LoadAsync(id, tracking: true, ct);
        var requestedCode = AdminMapping.NullIfEmpty(request.Code)?.ToUpperInvariant();
        if (requestedCode is not null && requestedCode != product.Code)
            throw new BusinessRuleException("A product's code can't be changed after it is created, because SKUs and orders use it.", "code_locked");

        var removedFiles = await ApplyAsync(product, request, isNew: false, ct);
        admin.Audit(actor, "product.updated", "product", product.Id.ToString(CultureInfo.InvariantCulture), $"Updated {product.Code} {product.Name}");
        await db.SaveChangesAsync(ct);
        await DeleteFilesAsync(removedFiles, ct);

        logger.LogInformation("Product {Code} updated by {Actor}", product.Code, actor.Name);
        return await GetAsync(product.Id, ct);
    }

    /// <summary>Copies the request onto the product. Returns storage keys of images that were removed.</summary>
    private async Task<List<string>> ApplyAsync(Product product, AdminProductRequest r, bool isNew, CancellationToken ct)
    {
        var gender = ApiValues.ParseGender(r.Gender) ?? throw new BusinessRuleException("Choose who the shoe is for.", "invalid_gender");
        var sizeSystem = r.SizeSystem.Trim().ToLowerInvariant() == "kids" ? SizeSystem.Kids : SizeSystem.Adult;
        var fit = r.Fit.Trim().ToLowerInvariant() switch
        {
            "small" => FitType.RunsSmall,
            "large" => FitType.RunsLarge,
            _ => FitType.TrueToSize,
        };

        // Brand: existing or new.
        Brand brand;
        if (AdminMapping.NullIfEmpty(r.NewBrandName) is { } newBrand)
        {
            brand = await db.Brands.FirstOrDefaultAsync(b => b.Name == newBrand, ct) ?? new Brand { Name = newBrand, Slug = Slugify(newBrand) };
            if (brand.Id == 0 && await db.Brands.AnyAsync(b => b.Slug == brand.Slug, ct))
                throw new ConflictException($"A brand like \"{newBrand}\" already exists. Pick it from the list.", "duplicate_brand");
        }
        else
        {
            brand = await db.Brands.FirstOrDefaultAsync(b => b.Id == r.BrandId, ct)
                    ?? throw new BusinessRuleException("Choose a brand.", "invalid_brand");
        }

        // Categories.
        var categoryCodes = r.Categories.Select(c => c.Trim().ToLowerInvariant()).Distinct().ToList();
        var categories = await db.Categories.Where(c => categoryCodes.Contains(c.Code)).ToListAsync(ct);
        if (categories.Count != categoryCodes.Count || categories.Count == 0)
            throw new BusinessRuleException("Choose at least one valid category.", "invalid_category");

        // Prices: the sale price (if any) is what customers pay; the regular price is shown struck through.
        if (r.SalePrice is { } sale && sale >= r.RegularPrice)
            throw new BusinessRuleException("The sale price must be lower than the regular price.", "invalid_sale_price");

        var nameChanged = product.Name != r.Name.Trim();
        product.Name = r.Name.Trim();
        product.Brand = brand;
        product.Gender = gender;
        if (!isNew && product.SizeSystem != sizeSystem && product.Variants.Count > 0)
            throw new BusinessRuleException("The sizing (adult or kids) can't change once sizes exist. Create a new product instead.", "size_system_locked");
        product.SizeSystem = sizeSystem;
        product.Fit = fit;
        product.Silhouette = r.Silhouette.Trim().ToLowerInvariant();
        product.Description = r.Description.Trim();
        product.Materials = AdminMapping.Normalize(r.Materials);
        product.Care = AdminMapping.Normalize(r.Care);
        product.Price = r.SalePrice ?? r.RegularPrice;
        product.OriginalPrice = r.SalePrice is null ? null : r.RegularPrice;
        product.IsActive = r.IsActive;
        product.IsFeatured = r.IsFeatured;
        product.IsNewArrival = r.IsNewArrival;
        if (isNew || nameChanged) product.Slug = await UniqueSlugAsync($"{Slugify(product.Name)}-{product.Code.ToLowerInvariant()}", product.Id, ct);

        // Categories: replace the set.
        foreach (var link in product.ProductCategories.Where(pc => !categoryCodes.Contains(pc.Category.Code)).ToList())
            product.ProductCategories.Remove(link);
        foreach (var category in categories.Where(c => product.ProductCategories.All(pc => pc.CategoryId != c.Id)))
            product.ProductCategories.Add(new ProductCategory { Product = product, Category = category, CategoryId = category.Id });

        // Highlights: replace the list.
        var highlights = (r.Highlights ?? []).Select(h => h.Trim()).Where(h => h.Length > 0).Take(8).ToList();
        foreach (var old in product.Highlights.ToList()) product.Highlights.Remove(old);
        for (var i = 0; i < highlights.Count; i++) product.Highlights.Add(new ProductHighlight { Text = highlights[i], SortOrder = i });

        return await ApplyColoursAsync(product, r.Colours, sizeSystem, ct);
    }

    private async Task<List<string>> ApplyColoursAsync(Product product, IReadOnlyList<AdminColourRequest> requested, SizeSystem sizeSystem, CancellationToken ct)
    {
        if (requested.Count == 0) throw new BusinessRuleException("Add at least one colour.", "colour_required");

        var sizes = await db.Sizes.Where(s => s.SizeSystem == sizeSystem).ToDictionaryAsync(s => s.Code, StringComparer.OrdinalIgnoreCase, ct);
        var existingImages = product.Colours.SelectMany(c => c.Images).ToList();
        var removedKeys = new List<string>();

        // Colours removed from the request.
        var keepIds = requested.Where(c => c.Id is not null).Select(c => c.Id!.Value).ToHashSet();
        foreach (var colour in product.Colours.Where(c => !keepIds.Contains(c.Id)).ToList())
        {
            var stocked = product.Variants.Where(v => v.ProductColourId == colour.Id && v.StockQuantity > 0).ToList();
            if (stocked.Count > 0)
                throw new BusinessRuleException($"{colour.Name} still has {stocked.Sum(v => v.StockQuantity)} pairs in stock. Adjust its stock to zero before removing it.", "colour_has_stock");
            foreach (var variant in product.Variants.Where(v => v.ProductColourId == colour.Id).ToList())
                product.Variants.Remove(variant);
            removedKeys.AddRange(colour.Images.Where(i => i.StorageKey is not null).Select(i => i.StorageKey!));
            product.Colours.Remove(colour);
        }

        for (var index = 0; index < requested.Count; index++)
        {
            var req = requested[index];
            ProductColour colour;
            if (req.Id is { } colourId)
            {
                colour = product.Colours.FirstOrDefault(c => c.Id == colourId)
                         ?? throw new BusinessRuleException("One of the colours no longer exists. Refresh and try again.", "colour_not_found");
            }
            else
            {
                colour = new ProductColour { Product = product, Code = UniqueColourCode(product, req.Name) };
                product.Colours.Add(colour);
            }

            colour.Name = req.Name.Trim();
            colour.SwatchHex = req.Swatch.Trim();
            colour.Family = req.Family.Trim().ToLowerInvariant();
            colour.SortOrder = index;

            removedKeys.AddRange(ApplyImages(colour, req.Images, existingImages));
            ApplySizes(product, colour, req.Sizes, sizes);
        }

        // Only delete stored files that no remaining image still uses.
        var stillUsed = product.Colours.SelectMany(c => c.Images).Select(i => i.StorageKey).Where(k => k is not null).ToHashSet();
        return removedKeys.Where(k => !stillUsed.Contains(k)).Distinct().ToList();
    }

    private List<string> ApplyImages(ProductColour colour, IReadOnlyList<AdminImageRequest> requested, List<ProductImage> productImages)
    {
        var removed = new List<string>();
        var current = colour.Images.ToList();
        var wanted = new List<ProductImage>();

        foreach (var img in requested)
        {
            var url = img.Url.Trim();
            // Accept images already on this product (any colour) or files uploaded through our own storage.
            var existing = current.FirstOrDefault(i => i.Url == url) ?? productImages.FirstOrDefault(i => i.Url == url);
            var key = storage.KeyFromUrl(url);
            if (existing is null && key is null)
                throw new BusinessRuleException("Images must be uploaded from your computer. Links to other websites can't be added.", "invalid_image_url");

            if (existing is not null && current.Contains(existing))
            {
                existing.AltText = AdminMapping.NullIfEmpty(img.AltText);
                wanted.Add(existing);
            }
            else
            {
                var image = new ProductImage { Url = url, AltText = AdminMapping.NullIfEmpty(img.AltText), StorageKey = existing?.StorageKey ?? key };
                colour.Images.Add(image);
                wanted.Add(image);
            }
        }

        foreach (var image in current.Where(i => !wanted.Contains(i)))
        {
            if (image.StorageKey is not null) removed.Add(image.StorageKey);
            colour.Images.Remove(image);
        }
        for (var i = 0; i < wanted.Count; i++) wanted[i].SortOrder = i;
        return removed;
    }

    private static void ApplySizes(Product product, ProductColour colour, IReadOnlyList<string> requested, Dictionary<string, Size> sizes)
    {
        var wanted = new List<Size>();
        foreach (var code in requested.Select(s => s.Trim()).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (!sizes.TryGetValue(code, out var size))
                throw new BusinessRuleException($"UK {code} isn't a valid size for this product's sizing.", "invalid_size");
            wanted.Add(size);
        }
        if (wanted.Count == 0) throw new BusinessRuleException($"Choose at least one size for {colour.Name}.", "size_required");

        var variants = product.Variants.Where(v => (colour.Id != 0 && v.ProductColourId == colour.Id) || v.Colour == colour).ToList();
        foreach (var variant in variants.Where(v => wanted.All(s => s.Id != v.SizeId)))
        {
            if (variant.StockQuantity > 0)
                throw new BusinessRuleException(
                    $"{colour.Name} UK {variant.Size.Label} still has {variant.StockQuantity} in stock. Adjust its stock to zero before removing the size.",
                    "size_has_stock");
            product.Variants.Remove(variant);
        }
        foreach (var size in wanted.Where(s => variants.All(v => v.SizeId != s.Id)))
        {
            product.Variants.Add(new ProductVariant
            {
                Product = product,
                Colour = colour,
                Size = size,
                SizeId = size.Id,
                Sku = Truncate($"{product.Code}-{colour.Code.ToUpperInvariant()}-{size.Code}", 40),
                StockQuantity = 0,
            });
        }
    }

    // ------------------------------------------------------------------ Status, colours, delete

    public async Task<AdminProductDto> SetStatusAsync(int id, AdminProductStatusRequest request, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);
        var product = await db.Products.FirstOrDefaultAsync(p => p.Id == id, ct)
                      ?? throw new NotFoundException("That product doesn't exist.", "product_not_found");
        var changes = new List<string>();
        if (request.IsActive is { } active && active != product.IsActive)
        {
            product.IsActive = active;
            changes.Add(active ? "activated" : "deactivated");
        }
        if (request.IsFeatured is { } featured && featured != product.IsFeatured)
        {
            product.IsFeatured = featured;
            changes.Add(featured ? "featured" : "unfeatured");
        }
        if (changes.Count > 0)
        {
            admin.Audit(actor, "product.status", "product", id.ToString(CultureInfo.InvariantCulture), $"{product.Code} {string.Join(", ", changes)}");
            await db.SaveChangesAsync(ct);
        }
        return await GetAsync(id, ct);
    }

    public async Task<AdminProductDto> AddColourAsync(int id, AddColourRequest request, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);
        var product = await db.Products.Include(p => p.Colours).FirstOrDefaultAsync(p => p.Id == id, ct)
                      ?? throw new NotFoundException("That product doesn't exist.", "product_not_found");
        if (product.Colours.Any(c => string.Equals(c.Name, request.Name.Trim(), StringComparison.OrdinalIgnoreCase)))
            throw new ConflictException($"{product.Name} already has a colour called {request.Name.Trim()}.", "duplicate_colour");

        product.Colours.Add(new ProductColour
        {
            Product = product,
            Code = UniqueColourCode(product, request.Name),
            Name = request.Name.Trim(),
            SwatchHex = request.Swatch.Trim(),
            Family = request.Family.Trim().ToLowerInvariant(),
            SortOrder = product.Colours.Count,
        });
        product.ModifiedUtc = clock.UtcNow;
        admin.Audit(actor, "product.colour-added", "product", id.ToString(CultureInfo.InvariantCulture), $"{product.Code}: added colour {request.Name.Trim()}");
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var actor = await admin.GetActorAsync(ct);
        var product = await LoadAsync(id, tracking: true, ct);
        var (canDelete, reason) = await DeleteCheckAsync(product, ct);
        if (!canDelete) throw new ConflictException(reason!, "product_in_use");

        var keys = product.Colours.SelectMany(c => c.Images).Where(i => i.StorageKey is not null).Select(i => i.StorageKey!).Distinct().ToList();

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Receipts keep their product snapshot; only the link is cleared.
        await db.StockReceipts.Where(r => r.ProductId == id).ExecuteUpdateAsync(s => s.SetProperty(r => r.ProductId, (int?)null), ct);
        // Variants must go before colours (the colour → variant link doesn't cascade).
        foreach (var variant in product.Variants.ToList()) db.ProductVariants.Remove(variant);
        db.Products.Remove(product);
        admin.Audit(actor, "product.deleted", "product", id.ToString(CultureInfo.InvariantCulture), $"Deleted {product.Code} {product.Name}");
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        await DeleteFilesAsync(keys, ct);
        logger.LogInformation("Product {Code} deleted by {Actor}", product.Code, actor.Name);
    }

    // ------------------------------------------------------------------ Helpers

    private async Task DeleteFilesAsync(IEnumerable<string> keys, CancellationToken ct)
    {
        foreach (var key in keys)
        {
            // Another product may share the file (e.g. a duplicated product); keep it if so.
            if (await db.ProductImages.AnyAsync(i => i.StorageKey == key, ct)) continue;
            try { await storage.DeleteAsync(key, ct); }
            catch (Exception ex) { logger.LogWarning(ex, "Couldn't delete stored image {Key}", key); }
        }
    }

    private async Task<string> NextCodeAsync(CancellationToken ct)
    {
        var codes = await db.Products.AsNoTracking().Where(p => p.Code.StartsWith("P")).Select(p => p.Code).ToListAsync(ct);
        var max = codes.Select(c => int.TryParse(c.AsSpan(1), NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 0)
            .DefaultIfEmpty(0).Max();
        return $"P{max + 1:000}";
    }

    private async Task<string> UniqueSlugAsync(string baseSlug, int productId, CancellationToken ct)
    {
        var slug = Truncate(baseSlug, 150).Trim('-');
        var candidate = slug;
        for (var i = 2; await db.Products.AnyAsync(p => p.Slug == candidate && p.Id != productId, ct); i++)
            candidate = $"{slug}-{i}";
        return candidate;
    }

    private static string UniqueColourCode(Product product, string name)
    {
        var baseCode = Truncate(Slugify(name), 36);
        if (baseCode.Length == 0) baseCode = "colour";
        var code = baseCode;
        for (var i = 2; product.Colours.Any(c => c.Code == code); i++) code = $"{baseCode}-{i}";
        return code;
    }

    public static string Slugify(string value)
    {
        var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(char.IsLetterOrDigit(ch) ? ch : '-');
        }
        return MultiDash().Replace(sb.ToString(), "-").Trim('-');
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];

    [GeneratedRegex("-{2,}")]
    private static partial Regex MultiDash();
}
