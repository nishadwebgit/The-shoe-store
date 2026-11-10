import { colourFamilies } from '../../data/colours';
import { categoryLabels, genderLabels, sizeOrder } from '../../data/labels';
import type { FacetValue, Gender, Product, ProductFacets, ProductQuery, ProductSearchResult } from '../../types';

/**
 * Pure catalogue querying used by the mock product service. It mirrors what the ASP.NET Core
 * API will do server-side (e.g. with EF Core LINQ), so behaviour stays the same after the switch.
 */

export function productInStock(product: Product): boolean {
  return product.variants.some((v) => v.stock > 0);
}

function matchesGender(product: Product, genders: Gender[]): boolean {
  // Unisex shoes appear under both Men and Women.
  return genders.some((g) => product.gender === g || (product.gender === 'unisex' && (g === 'men' || g === 'women')));
}

function matchesSearch(product: Product, search: string): boolean {
  const haystack = [
    product.name,
    product.brand,
    genderLabels[product.gender],
    ...product.categories.map((c) => categoryLabels[c]),
    ...product.colours.map((c) => c.name),
  ]
    .join(' ')
    .toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token) || haystack.includes(token.replace(/s$/, '')));
}

type FacetKey = 'genders' | 'categories' | 'brands' | 'sizes' | 'colours';

function applyFilters(products: Product[], q: ProductQuery, skip?: FacetKey): Product[] {
  return products.filter((p) => {
    if (q.search && !matchesSearch(p, q.search)) return false;
    if (skip !== 'genders' && q.genders?.length && !matchesGender(p, q.genders)) return false;
    if (skip !== 'categories' && q.categories?.length && !q.categories.some((c) => p.categories.includes(c))) return false;
    if (skip !== 'brands' && q.brands?.length && !q.brands.includes(p.brand)) return false;
    if (skip !== 'sizes' && q.sizes?.length && !p.variants.some((v) => q.sizes?.includes(v.size) && v.stock > 0)) return false;
    if (skip !== 'colours' && q.colours?.length && !p.colours.some((c) => q.colours?.includes(c.family))) return false;
    if (q.minPrice !== undefined && p.price < q.minPrice) return false;
    if (q.maxPrice !== undefined && p.price > q.maxPrice) return false;
    if (q.minRating !== undefined && p.rating < q.minRating) return false;
    if (q.inStockOnly && !productInStock(p)) return false;
    if (q.onSaleOnly && !(p.originalPrice && p.originalPrice > p.price)) return false;
    if (q.collection === 'new' && !p.isNewArrival) return false;
    if (q.collection === 'best-sellers' && !p.isBestSeller) return false;
    if (q.collection === 'featured' && !p.isFeatured) return false;
    return true;
  });
}

function sortProducts(list: Product[], sort: ProductQuery['sort']): Product[] {
  const sorted = [...list];
  switch (sort) {
    case 'newest':
      return sorted.sort((a, b) => b.releasedAt.localeCompare(a.releasedAt) || a.id.localeCompare(b.id));
    case 'popular':
      return sorted.sort((a, b) => b.popularity - a.popularity);
    case 'price-asc':
      return sorted.sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
    case 'price-desc':
      return sorted.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
    case 'rating':
      return sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    case 'featured':
    default:
      // Featured first, then in-stock, then popularity.
      return sorted.sort(
        (a, b) =>
          Number(b.isFeatured) - Number(a.isFeatured) ||
          Number(productInStock(b)) - Number(productInStock(a)) ||
          b.popularity - a.popularity,
      );
  }
}

function countBy(values: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return map;
}

function buildFacets(all: Product[], q: ProductQuery): ProductFacets {
  const forGenders = applyFilters(all, q, 'genders');
  const genderCounts: FacetValue[] = (['men', 'women', 'kids'] as Gender[]).map((g) => ({
    value: g,
    label: genderLabels[g],
    count: forGenders.filter((p) => matchesGender(p, [g])).length,
  }));

  const forCategories = applyFilters(all, q, 'categories');
  const catCounts = countBy(forCategories.flatMap((p) => p.categories));
  const categories = (Object.keys(categoryLabels) as (keyof typeof categoryLabels)[]).map((c) => ({
    value: c,
    label: categoryLabels[c],
    count: catCounts.get(c) ?? 0,
  }));

  const forBrands = applyFilters(all, q, 'brands');
  const brandCounts = countBy(forBrands.map((p) => p.brand));
  const brands = [...new Set(all.map((p) => p.brand))]
    .sort()
    .map((b) => ({ value: b, label: b, count: brandCounts.get(b) ?? 0 }));

  const forSizes = applyFilters(all, q, 'sizes');
  const sizeCounts = countBy(
    forSizes.flatMap((p) => [...new Set(p.variants.filter((v) => v.stock > 0).map((v) => v.size))]),
  );
  const sizeFacet = (s: string): FacetValue => ({
    value: s,
    label: s.endsWith('K') ? s.replace('K', '') : s,
    count: sizeCounts.get(s) ?? 0,
  });

  const forColours = applyFilters(all, q, 'colours');
  const colourCounts = countBy(forColours.flatMap((p) => [...new Set(p.colours.map((c) => c.family))]));
  const colours = Object.entries(colourFamilies).map(([value, def]) => ({
    value,
    label: def.label,
    swatch: def.swatch,
    count: colourCounts.get(value) ?? 0,
  }));

  const prices = all.map((p) => p.price);
  return {
    genders: genderCounts,
    categories,
    brands,
    sizes: {
      adult: sizeOrder.filter((s) => !s.endsWith('K')).map(sizeFacet),
      kids: sizeOrder.filter((s) => s.endsWith('K')).map(sizeFacet),
    },
    colours,
    priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
  };
}

export function queryProducts(all: Product[], q: ProductQuery): ProductSearchResult {
  const filtered = sortProducts(applyFilters(all, q), q.sort);
  const pageSize = q.pageSize ?? 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, q.page ?? 1), totalPages);
  return {
    // "Load more" semantics: return everything up to and including the requested page.
    items: filtered.slice(0, page * pageSize),
    page,
    pageSize,
    totalCount: filtered.length,
    totalPages,
    facets: buildFacets(all, q),
  };
}
