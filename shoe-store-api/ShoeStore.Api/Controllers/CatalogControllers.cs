using Microsoft.AspNetCore.Mvc;
using ShoeStore.Application.Dtos;
using ShoeStore.Application.Services;

namespace ShoeStore.Api.Controllers;

/// <summary>Product catalogue: search, filters, details, collections, reviews and variants.</summary>
[ApiController]
[Route("api/v1/products")]
[Tags("Products")]
[Produces("application/json")]
public sealed class ProductsController(IProductService products) : ControllerBase
{
    /// <summary>Search and filter products (paged, with facets).</summary>
    /// <remarks>
    /// List filters are comma-separated, e.g. <c>?gender=men&amp;category=running,trail&amp;size=8&amp;sort=price-asc&amp;page=1&amp;pageSize=12</c>.
    /// Facet counts reflect all other active filters, so the client can disable options that would return nothing.
    /// </remarks>
    [HttpGet]
    [ProducesResponseType<ProductSearchResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ProductSearchResultDto>> Search([FromQuery] ProductQueryParameters query, CancellationToken ct) =>
        Ok(await products.SearchAsync(query, ct));

    /// <summary>Search products by name, brand, category or colour (alias of the main listing with a search term).</summary>
    [HttpGet("search")]
    [ProducesResponseType<ProductSearchResultDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ProductSearchResultDto>> SearchByText([FromQuery] ProductQueryParameters query, CancellationToken ct) =>
        Ok(await products.SearchAsync(query, ct));

    /// <summary>Featured products.</summary>
    [HttpGet("featured")]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> Featured([FromQuery] int limit = 8, CancellationToken ct = default) =>
        Ok(await products.GetCollectionAsync("featured", limit, ct));

    /// <summary>New arrivals, newest first.</summary>
    [HttpGet("new-arrivals")]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> NewArrivals([FromQuery] int limit = 8, CancellationToken ct = default) =>
        Ok(await products.GetCollectionAsync("new", limit, ct));

    /// <summary>Best-selling products.</summary>
    [HttpGet("best-sellers")]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> BestSellers([FromQuery] int limit = 8, CancellationToken ct = default) =>
        Ok(await products.GetCollectionAsync("best-sellers", limit, ct));

    /// <summary>Products currently on sale.</summary>
    [HttpGet("sale")]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> OnSale([FromQuery] int limit = 8, CancellationToken ct = default) =>
        Ok(await products.GetCollectionAsync("sale", limit, ct));

    /// <summary>Highly rated in-stock products, excluding the given product ids (e.g. what is already in the bag).</summary>
    [HttpGet("recommendations")]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> Recommendations([FromQuery] string? exclude, [FromQuery] int limit = 4, CancellationToken ct = default) =>
        Ok(await products.GetRecommendationsAsync(ApiValues.SplitList(exclude), limit, ct));

    /// <summary>Get one product by id (e.g. P001) or slug.</summary>
    [HttpGet("{idOrSlug}")]
    [ProducesResponseType<ProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDto>> Get(string idOrSlug, CancellationToken ct) =>
        Ok(await products.GetAsync(idOrSlug, ct));

    /// <summary>Products related to this one (shared categories, gender and brand).</summary>
    [HttpGet("{idOrSlug}/related")]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> Related(string idOrSlug, [FromQuery] int limit = 4, CancellationToken ct = default) =>
        Ok(await products.GetRelatedAsync(idOrSlug, limit, ct));

    /// <summary>Customer reviews for a product.</summary>
    [HttpGet("{idOrSlug}/reviews")]
    public async Task<ActionResult<IReadOnlyList<ReviewDto>>> Reviews(string idOrSlug, CancellationToken ct) =>
        Ok(await products.GetReviewsAsync(idOrSlug, ct));

    /// <summary>All colour/size variants (SKUs) with live stock.</summary>
    [HttpGet("{idOrSlug}/variants")]
    public async Task<ActionResult<IReadOnlyList<VariantDto>>> Variants(string idOrSlug, CancellationToken ct) =>
        Ok(await products.GetVariantsAsync(idOrSlug, ct));

    /// <summary>Stock for one colour and size.</summary>
    [HttpGet("{idOrSlug}/stock")]
    [ProducesResponseType<StockDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<StockDto>> Stock(string idOrSlug, [FromQuery] string colour, [FromQuery] string size, CancellationToken ct) =>
        Ok(await products.GetStockAsync(idOrSlug, colour, size, ct));
}

/// <summary>Style categories (running, lifestyle, boots…).</summary>
[ApiController]
[Route("api/v1/categories")]
[Tags("Categories & brands")]
[Produces("application/json")]
public sealed class CategoriesController(ICatalogService catalog, IProductService products) : ControllerBase
{
    /// <summary>All categories with the number of active products in each.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CategoryDto>>> GetAll(CancellationToken ct) => Ok(await catalog.GetCategoriesAsync(ct));

    /// <summary>One category by code, e.g. running.</summary>
    [HttpGet("{code}")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CategoryDto>> Get(string code, CancellationToken ct) => Ok(await catalog.GetCategoryAsync(code, ct));

    /// <summary>Products in a category (same filters and paging as /products).</summary>
    [HttpGet("{code}/products")]
    public async Task<ActionResult<ProductSearchResultDto>> Products(string code, [FromQuery] ProductQueryParameters query, CancellationToken ct)
    {
        await catalog.GetCategoryAsync(code, ct);
        query.Category = code;
        return Ok(await products.SearchAsync(query, ct));
    }
}

[ApiController]
[Route("api/v1/brands")]
[Tags("Categories & brands")]
[Produces("application/json")]
public sealed class BrandsController(ICatalogService catalog, IProductService products) : ControllerBase
{
    /// <summary>All brands with active product counts.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BrandDto>>> GetAll(CancellationToken ct) => Ok(await catalog.GetBrandsAsync(ct));

    /// <summary>One brand by id or slug, e.g. new-balance.</summary>
    [HttpGet("{idOrSlug}")]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BrandDto>> Get(string idOrSlug, CancellationToken ct) => Ok(await catalog.GetBrandAsync(idOrSlug, ct));

    /// <summary>Products from a brand (same filters and paging as /products).</summary>
    [HttpGet("{idOrSlug}/products")]
    public async Task<ActionResult<ProductSearchResultDto>> Products(string idOrSlug, [FromQuery] ProductQueryParameters query, CancellationToken ct)
    {
        var brand = await catalog.GetBrandAsync(idOrSlug, ct);
        query.Brand = brand.Name;
        return Ok(await products.SearchAsync(query, ct));
    }
}

[ApiController]
[Route("api/v1")]
[Tags("Inventory")]
[Produces("application/json")]
public sealed class InventoryController(ICatalogService catalog, IProductService products) : ControllerBase
{
    /// <summary>All shoe sizes (UK), adults and kids.</summary>
    [HttpGet("sizes")]
    public async Task<ActionResult<IReadOnlyList<SizeDto>>> Sizes(CancellationToken ct) => Ok(await catalog.GetSizesAsync(ct));

    /// <summary>Live stock for a list of SKUs.</summary>
    [HttpPost("inventory/check")]
    public async Task<ActionResult<IReadOnlyList<StockCheckResultDto>>> Check(StockCheckRequest request, CancellationToken ct) =>
        Ok(await products.CheckStockAsync(request.Skus, ct));
}
