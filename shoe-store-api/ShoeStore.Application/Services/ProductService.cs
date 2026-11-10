using Microsoft.EntityFrameworkCore;
using ShoeStore.Application.Abstractions;
using ShoeStore.Application.Common;
using ShoeStore.Application.Dtos;
using ShoeStore.Domain.Entities;
using ShoeStore.Domain.Enums;

namespace ShoeStore.Application.Services;

public interface IProductService
{
    Task<ProductSearchResultDto> SearchAsync(ProductQueryParameters query, CancellationToken ct);
    Task<ProductDto> GetAsync(string idOrSlug, CancellationToken ct);
    Task<IReadOnlyList<ProductDto>> GetCollectionAsync(string collection, int limit, CancellationToken ct);
    Task<IReadOnlyList<ProductDto>> GetRelatedAsync(string idOrSlug, int limit, CancellationToken ct);
    Task<IReadOnlyList<ProductDto>> GetRecommendationsAsync(IReadOnlyList<string> excludeIds, int limit, CancellationToken ct);
    Task<IReadOnlyList<ReviewDto>> GetReviewsAsync(string idOrSlug, CancellationToken ct);
    Task<IReadOnlyList<VariantDto>> GetVariantsAsync(string idOrSlug, CancellationToken ct);
    Task<StockDto> GetStockAsync(string idOrSlug, string colourId, string size, CancellationToken ct);
    Task<IReadOnlyList<StockCheckResultDto>> CheckStockAsync(IReadOnlyList<string> skus, CancellationToken ct);
}

/// <summary>Product catalogue queries: search with facets, details, collections, reviews and stock.</summary>
public sealed class ProductService(IAppDbContext db) : IProductService
{
    private const int MaxPageSize = 48;

    private enum FacetKey { None, Genders, Categories, Brands, Sizes, Colours }

    /// <summary>Parsed, normalised filter values.</summary>
    private sealed record Filter(
        IReadOnlyList<string> SearchTokens,
        IReadOnlyList<Gender> Genders,
        IReadOnlyList<string> Categories,
        IReadOnlyList<string> Brands,
        IReadOnlyList<string> Sizes,
        IReadOnlyList<string> Colours,
        IReadOnlyList<string> Ids,
        decimal? MinPrice,
        decimal? MaxPrice,
        decimal? MinRating,
        bool InStockOnly,
        bool OnSaleOnly,
        string? Collection);

    private static Filter ParseFilter(ProductQueryParameters q) => new(
        SearchTokens: (q.Search ?? string.Empty)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(t => t.Length > 3 && t.EndsWith('s') ? t[..^1] : t)
            .Take(6)
            .ToArray(),
        Genders: ApiValues.SplitList(q.Gender).Select(ApiValues.ParseGender).Where(g => g.HasValue).Select(g => g!.Value).ToArray(),
        Categories: ApiValues.SplitList(q.Category).Select(c => c.ToLowerInvariant()).ToArray(),
        Brands: ApiValues.SplitList(q.Brand),
        Sizes: ApiValues.SplitList(q.Size).Select(s => s.ToUpperInvariant()).ToArray(),
        Colours: ApiValues.SplitList(q.Colour).Select(c => c.ToLowerInvariant()).ToArray(),
        Ids: ApiValues.SplitList(q.Ids).Select(i => i.ToUpperInvariant()).ToArray(),
        MinPrice: q.MinPrice,
        MaxPrice: q.MaxPrice,
        MinRating: q.MinRating,
        InStockOnly: q.InStock == true,
        OnSaleOnly: q.OnSale == true,
        Collection: q.Collection?.Trim().ToLowerInvariant());

    private IQueryable<Product> ApplyFilters(Filter f, FacetKey skip = FacetKey.None)
    {
        var query = db.Products.AsNoTracking().Where(p => p.IsActive);

        foreach (var token in f.SearchTokens)
        {
            var t = token;
            var gender = ApiValues.ParseGender(t);
            query = query.Where(p =>
                p.Name.Contains(t) ||
                p.Brand.Name.Contains(t) ||
                p.ProductCategories.Any(pc => pc.Category.Name.Contains(t) || pc.Category.Code.Contains(t)) ||
                p.Colours.Any(c => c.Name.Contains(t) || c.Family.Contains(t)) ||
                (gender != null && p.Gender == gender));
        }

        if (skip != FacetKey.Genders && f.Genders.Count > 0)
        {
            var genders = f.Genders.ToList();
            var includeUnisex = genders.Contains(Gender.Men) || genders.Contains(Gender.Women);
            query = query.Where(p => genders.Contains(p.Gender) || (includeUnisex && p.Gender == Gender.Unisex));
        }

        if (skip != FacetKey.Categories && f.Categories.Count > 0)
        {
            var categories = f.Categories.ToList();
            query = query.Where(p => p.ProductCategories.Any(pc => categories.Contains(pc.Category.Code)));
        }

        if (skip != FacetKey.Brands && f.Brands.Count > 0)
        {
            var brands = f.Brands.ToList();
            query = query.Where(p => brands.Contains(p.Brand.Name) || brands.Contains(p.Brand.Slug));
        }

        if (skip != FacetKey.Sizes && f.Sizes.Count > 0)
        {
            var sizes = f.Sizes.ToList();
            query = query.Where(p => p.Variants.Any(v => v.StockQuantity > 0 && sizes.Contains(v.Size.Code)));
        }

        if (skip != FacetKey.Colours && f.Colours.Count > 0)
        {
            var colours = f.Colours.ToList();
            query = query.Where(p => p.Colours.Any(c => colours.Contains(c.Family)));
        }

        if (f.Ids.Count > 0)
        {
            var ids = f.Ids.ToList();
            query = query.Where(p => ids.Contains(p.Code));
        }

        if (f.MinPrice is { } min) query = query.Where(p => p.Price >= min);
        if (f.MaxPrice is { } max) query = query.Where(p => p.Price <= max);
        if (f.MinRating is { } rating) query = query.Where(p => p.Rating >= rating);
        if (f.InStockOnly) query = query.Where(p => p.Variants.Any(v => v.StockQuantity > 0));
        if (f.OnSaleOnly) query = query.Where(p => p.OriginalPrice != null && p.OriginalPrice > p.Price);

        query = f.Collection switch
        {
            "new" => query.Where(p => p.IsNewArrival),
            "best-sellers" => query.Where(p => p.IsBestSeller),
            "featured" => query.Where(p => p.IsFeatured),
            _ => query,
        };

        return query;
    }

    private static IOrderedQueryable<Product> ApplySort(IQueryable<Product> query, string? sort, string? collection)
    {
        var key = string.IsNullOrWhiteSpace(sort) ? (collection == "new" ? "newest" : "featured") : sort.Trim().ToLowerInvariant();
        return key switch
        {
            "newest" => query.OrderByDescending(p => p.ReleasedUtc).ThenBy(p => p.Code),
            "popular" => query.OrderByDescending(p => p.Popularity).ThenBy(p => p.Code),
            "price-asc" => query.OrderBy(p => p.Price).ThenBy(p => p.Code),
            "price-desc" => query.OrderByDescending(p => p.Price).ThenBy(p => p.Code),
            "rating" => query.OrderByDescending(p => p.Rating).ThenByDescending(p => p.ReviewCount).ThenBy(p => p.Code),
            _ => query
                .OrderByDescending(p => p.IsFeatured)
                .ThenByDescending(p => p.Variants.Any(v => v.StockQuantity > 0))
                .ThenByDescending(p => p.Popularity)
                .ThenBy(p => p.Code),
        };
    }

    /// <summary>Loads full product graphs for the given ids, preserving the order of <paramref name="ids"/>.</summary>
    private async Task<IReadOnlyList<ProductDto>> LoadProductsAsync(IReadOnlyList<int> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return Array.Empty<ProductDto>();
        var idList = ids.ToList();
        var products = await db.Products
            .AsNoTracking()
            .AsSplitQuery()
            .Include(p => p.Brand)
            .Include(p => p.ProductCategories).ThenInclude(pc => pc.Category)
            .Include(p => p.Colours).ThenInclude(c => c.Images)
            .Include(p => p.Variants).ThenInclude(v => v.Size)
            .Include(p => p.Highlights)
            .Include(p => p.Specifications)
            .Where(p => idList.Contains(p.Id))
            .ToListAsync(ct);

        var byId = products.ToDictionary(p => p.Id);
        return idList.Where(byId.ContainsKey).Select(id => byId[id].ToDto()).ToList();
    }

    private async Task<Product> FindAsync(string idOrSlug, CancellationToken ct)
    {
        var key = idOrSlug.Trim();
        var upper = key.ToUpperInvariant();
        var lower = key.ToLowerInvariant();
        var product = await db.Products.AsNoTracking()
            .FirstOrDefaultAsync(p => p.IsActive && (p.Code == upper || p.Slug == lower), ct);
        return product ?? throw new NotFoundException("We couldn't find that shoe. It may have been discontinued.", "product_not_found");
    }

    public async Task<ProductSearchResultDto> SearchAsync(ProductQueryParameters q, CancellationToken ct)
    {
        var filter = ParseFilter(q);
        var pageSize = Math.Clamp(q.PageSize, 1, MaxPageSize);
        var filtered = ApplyFilters(filter);

        var totalCount = await filtered.CountAsync(ct);
        var totalPages = Math.Max(1, (int)Math.Ceiling(totalCount / (double)pageSize));
        var page = Math.Clamp(q.Page, 1, totalPages);

        var pageIds = await ApplySort(filtered, q.Sort, filter.Collection)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => p.Id)
            .ToListAsync(ct);

        var items = await LoadProductsAsync(pageIds, ct);
        var facets = await BuildFacetsAsync(filter, ct);
        return new ProductSearchResultDto(items, page, pageSize, totalCount, totalPages, facets);
    }

    private async Task<ProductFacetsDto> BuildFacetsAsync(Filter f, CancellationToken ct)
    {
        // Each facet is counted against the results of every *other* active filter, so shoppers see
        // how many products each option would add, and options that would return nothing can be disabled.
        var genderBase = ApplyFilters(f, FacetKey.Genders);
        var genders = new List<FacetValueDto>();
        foreach (var g in new[] { Gender.Men, Gender.Women, Gender.Kids })
        {
            var includeUnisex = g != Gender.Kids;
            var count = await genderBase.CountAsync(p => p.Gender == g || (includeUnisex && p.Gender == Gender.Unisex), ct);
            genders.Add(new FacetValueDto(g.ToApi(), ApiValues.GenderLabel(g), count));
        }

        var categoryIds = ApplyFilters(f, FacetKey.Categories).Select(p => p.Id);
        var categoryCounts = await db.ProductCategories
            .Where(pc => categoryIds.Contains(pc.ProductId))
            .GroupBy(pc => pc.CategoryId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var categories = (await db.Categories.AsNoTracking().OrderBy(c => c.DisplayOrder).ToListAsync(ct))
            .Select(c => new FacetValueDto(c.Code, c.Name, categoryCounts.GetValueOrDefault(c.Id)))
            .ToList();

        var brandCounts = await ApplyFilters(f, FacetKey.Brands)
            .GroupBy(p => p.BrandId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var brands = (await db.Brands.AsNoTracking().OrderBy(b => b.Name).ToListAsync(ct))
            .Select(b => new FacetValueDto(b.Name, b.Name, brandCounts.GetValueOrDefault(b.Id)))
            .ToList();

        var sizeProductIds = ApplyFilters(f, FacetKey.Sizes).Select(p => p.Id);
        var sizeCounts = await db.ProductVariants
            .Where(v => v.StockQuantity > 0 && sizeProductIds.Contains(v.ProductId))
            .GroupBy(v => v.SizeId)
            .Select(g => new { g.Key, Count = g.Select(v => v.ProductId).Distinct().Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var allSizes = await db.Sizes.AsNoTracking().OrderBy(s => s.SortOrder).ToListAsync(ct);
        FacetValueDto SizeFacet(Size s) => new(s.Code, s.Label, sizeCounts.GetValueOrDefault(s.Id));

        var colourProductIds = ApplyFilters(f, FacetKey.Colours).Select(p => p.Id);
        var colourCounts = await db.ProductColours
            .Where(c => colourProductIds.Contains(c.ProductId))
            .GroupBy(c => c.Family)
            .Select(g => new { g.Key, Count = g.Select(c => c.ProductId).Distinct().Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        var colours = ApiValues.ColourFamilies
            .Select(c => new ColourFacetDto(c.Value, c.Label, colourCounts.GetValueOrDefault(c.Value), c.Swatch))
            .ToList();

        var active = db.Products.Where(p => p.IsActive);
        var hasProducts = await active.AnyAsync(ct);
        var priceRange = hasProducts
            ? new PriceRangeDto(await active.MinAsync(p => p.Price, ct), await active.MaxAsync(p => p.Price, ct))
            : new PriceRangeDto(0, 0);

        return new ProductFacetsDto(
            genders,
            categories,
            brands,
            new SizeFacetsDto(
                allSizes.Where(s => s.SizeSystem == SizeSystem.Adult).Select(SizeFacet).ToList(),
                allSizes.Where(s => s.SizeSystem == SizeSystem.Kids).Select(SizeFacet).ToList()),
            colours,
            priceRange);
    }

    public async Task<ProductDto> GetAsync(string idOrSlug, CancellationToken ct)
    {
        var product = await FindAsync(idOrSlug, ct);
        return (await LoadProductsAsync([product.Id], ct))[0];
    }

    public async Task<IReadOnlyList<ProductDto>> GetCollectionAsync(string collection, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, MaxPageSize);
        var inStock = db.Products.AsNoTracking().Where(p => p.IsActive && p.Variants.Any(v => v.StockQuantity > 0));
        IQueryable<Product> query = collection.ToLowerInvariant() switch
        {
            "featured" => inStock.Where(p => p.IsFeatured).OrderByDescending(p => p.Popularity),
            "new" or "new-arrivals" => inStock.Where(p => p.IsNewArrival).OrderByDescending(p => p.ReleasedUtc),
            "best-sellers" or "bestsellers" => inStock.Where(p => p.IsBestSeller).OrderByDescending(p => p.Popularity),
            "sale" => inStock.Where(p => p.OriginalPrice != null && p.OriginalPrice > p.Price).OrderByDescending(p => p.Popularity),
            _ => throw new NotFoundException($"There is no \"{collection}\" collection. Use featured, new-arrivals, best-sellers or sale.", "collection_not_found"),
        };
        var ids = await query.Select(p => p.Id).Take(limit).ToListAsync(ct);
        return await LoadProductsAsync(ids, ct);
    }

    public async Task<IReadOnlyList<ProductDto>> GetRelatedAsync(string idOrSlug, int limit, CancellationToken ct)
    {
        var source = await FindAsync(idOrSlug, ct);
        limit = Math.Clamp(limit, 1, 12);

        var sourceCategories = await db.ProductCategories.Where(pc => pc.ProductId == source.Id).Select(pc => pc.CategoryId).ToListAsync(ct);

        // Score candidates by shared categories, compatible gender, same brand and popularity.
        var candidates = await db.Products.AsNoTracking()
            .Where(p => p.IsActive && p.Id != source.Id && p.Name != source.Name && p.Variants.Any(v => v.StockQuantity > 0))
            .Select(p => new
            {
                p.Id,
                p.Gender,
                p.BrandId,
                p.Popularity,
                Shared = p.ProductCategories.Count(pc => sourceCategories.Contains(pc.CategoryId)),
            })
            .ToListAsync(ct);

        var ids = candidates
            .Select(c => new
            {
                c.Id,
                Score = c.Shared * 3
                        + (c.Gender == source.Gender || c.Gender == Gender.Unisex || source.Gender == Gender.Unisex ? 2 : 0)
                        + (c.BrandId == source.BrandId ? 1 : 0)
                        + c.Popularity / 100.0,
            })
            .OrderByDescending(c => c.Score)
            .Take(limit)
            .Select(c => c.Id)
            .ToList();

        return await LoadProductsAsync(ids, ct);
    }

    public async Task<IReadOnlyList<ProductDto>> GetRecommendationsAsync(IReadOnlyList<string> excludeIds, int limit, CancellationToken ct)
    {
        limit = Math.Clamp(limit, 1, 12);
        var exclude = excludeIds.Select(e => e.ToUpperInvariant()).ToList();
        var ids = await db.Products.AsNoTracking()
            .Where(p => p.IsActive && !exclude.Contains(p.Code) && p.Variants.Any(v => v.StockQuantity > 0))
            .OrderByDescending(p => (double)p.Rating * 20 + p.Popularity)
            .ThenBy(p => p.Code)
            .Select(p => p.Id)
            .Take(limit)
            .ToListAsync(ct);
        return await LoadProductsAsync(ids, ct);
    }

    public async Task<IReadOnlyList<ReviewDto>> GetReviewsAsync(string idOrSlug, CancellationToken ct)
    {
        var product = await FindAsync(idOrSlug, ct);
        var reviews = await db.ProductReviews.AsNoTracking()
            .Where(r => r.ProductId == product.Id)
            .OrderByDescending(r => r.CreatedUtc)
            .ToListAsync(ct);
        return reviews.Select(r => r.ToDto(product.Code)).ToList();
    }

    public async Task<IReadOnlyList<VariantDto>> GetVariantsAsync(string idOrSlug, CancellationToken ct)
    {
        var product = await FindAsync(idOrSlug, ct);
        return await db.ProductVariants.AsNoTracking()
            .Where(v => v.ProductId == product.Id)
            .OrderBy(v => v.Colour.SortOrder).ThenBy(v => v.Size.SortOrder)
            .Select(v => new VariantDto(v.Sku, v.Colour.Code, v.Size.Code, v.StockQuantity < 0 ? 0 : v.StockQuantity))
            .ToListAsync(ct);
    }

    public async Task<StockDto> GetStockAsync(string idOrSlug, string colourId, string size, CancellationToken ct)
    {
        var product = await FindAsync(idOrSlug, ct);
        var colour = colourId.Trim().ToLowerInvariant();
        var sizeCode = size.Trim().ToUpperInvariant();
        var variant = await db.ProductVariants.AsNoTracking()
            .Where(v => v.ProductId == product.Id && v.Colour.Code == colour && v.Size.Code == sizeCode)
            .Select(v => new { v.Sku, v.StockQuantity })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException($"{product.Name} isn't made in that colour and size.", "variant_not_found");
        var available = Math.Max(0, variant.StockQuantity);
        return new StockDto(variant.Sku, product.Code, colour, sizeCode, available, available > 0);
    }

    public async Task<IReadOnlyList<StockCheckResultDto>> CheckStockAsync(IReadOnlyList<string> skus, CancellationToken ct)
    {
        var list = skus.Select(s => s.Trim().ToUpperInvariant()).Distinct().Take(100).ToList();
        var found = await db.ProductVariants.AsNoTracking()
            .Where(v => list.Contains(v.Sku))
            .Select(v => new { v.Sku, v.StockQuantity })
            .ToDictionaryAsync(v => v.Sku, v => v.StockQuantity, ct);
        return list.Select(s => new StockCheckResultDto(s, Math.Max(0, found.GetValueOrDefault(s)))).ToList();
    }
}
