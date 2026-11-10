import { useState } from 'react';
import { SearchX, SlidersHorizontal, X } from 'lucide-react';
import { ProductCard, ProductCardSkeleton } from '../components/product/ProductCard';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { EmptyState, ErrorState } from '../components/ui/Feedback';
import { colourFamilies } from '../data/colours';
import { categoryLabels, genderLabels } from '../data/labels';
import { FilterPanel } from '../features/catalogue/FilterPanel';
import { useCatalogueParams, type ListParam } from '../features/catalogue/useCatalogueParams';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePreferences } from '../hooks/useStore';
import { services } from '../services';
import type { Gender, ProductQuery, SortOption, StyleCategory } from '../types';
import { formatPrice } from '../utils/format';

const sortLabels: Record<SortOption, string> = {
  featured: 'Featured',
  newest: 'Newest arrivals',
  popular: 'Most popular',
  rating: 'Highest rated',
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
};

function priceChipLabel(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${formatPrice(min)} – ${formatPrice(max)}`;
  if (min !== undefined) return `From ${formatPrice(min)}`;
  return `Up to ${formatPrice(max ?? 0)}`;
}

function pageHeading(q: ProductQuery): string {
  if (q.search) return `Results for “${q.search}”`;
  if (q.collection === 'new') return 'New arrivals';
  if (q.collection === 'best-sellers') return 'Best sellers';
  if (q.onSaleOnly) return 'Sale';
  const g = q.genders?.length === 1 ? q.genders[0] : undefined;
  const c = q.categories?.length === 1 ? q.categories[0] : undefined;
  if (g && c) return `${genderLabels[g as Gender]}'s ${categoryLabels[c as StyleCategory].toLowerCase()}`;
  if (g) return `${genderLabels[g as Gender]}'s shoes`;
  if (c) return categoryLabels[c as StyleCategory];
  return 'All shoes';
}

interface Chip {
  key: string;
  label: string;
  remove: () => void;
}

export function ShopPage() {
  const { query, toggleValue, setValue, update, clearAll } = useCatalogueParams();
  const { preferredSize } = usePreferences();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const heading = pageHeading(query);
  useDocumentTitle(heading);

  const { data, loading, error, reload } = useAsync(() => services.products.searchProducts(query), [JSON.stringify(query)]);

  const chips: Chip[] = [];
  const listChip = (key: ListParam, values: string[] | undefined, label: (v: string) => string) =>
    values?.forEach((v) => chips.push({ key: `${key}-${v}`, label: label(v), remove: () => toggleValue(key, v) }));
  listChip('size', query.sizes, (v) => `UK ${v.replace('K', '')}${v.endsWith('K') ? ' kids' : ''}`);
  listChip('gender', query.genders, (v) => genderLabels[v as Gender]);
  listChip('category', query.categories, (v) => categoryLabels[v as StyleCategory]);
  listChip('brand', query.brands, (v) => v);
  listChip('colour', query.colours, (v) => colourFamilies[v]?.label ?? v);
  if (query.minPrice !== undefined || query.maxPrice !== undefined)
    chips.push({ key: 'price', label: priceChipLabel(query.minPrice, query.maxPrice), remove: () => update((n) => { n.delete('min'); n.delete('max'); }) });
  if (query.minRating) chips.push({ key: 'rating', label: `${query.minRating}+ stars`, remove: () => setValue('rating', undefined) });
  if (query.inStockOnly) chips.push({ key: 'stock', label: 'In stock', remove: () => setValue('stock', undefined) });
  if (query.onSaleOnly) chips.push({ key: 'sale', label: 'On sale', remove: () => setValue('sale', undefined) });
  if (query.collection) chips.push({ key: 'collection', label: query.collection === 'new' ? 'New arrivals' : query.collection === 'best-sellers' ? 'Best sellers' : 'Featured', remove: () => setValue('collection', undefined) });

  const filterPanel = data && (
    <FilterPanel facets={data.facets} query={query} toggleValue={toggleValue} setValue={setValue} update={update} preferredSize={preferredSize} />
  );

  const highlightSize = query.sizes?.length === 1 ? query.sizes[0] : null;
  const resultsText = data ? `${data.totalCount} ${data.totalCount === 1 ? 'shoe' : 'shoes'}` : '';

  return (
    <div className="container shop">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Shop', to: '/shop' }, ...(heading !== 'All shoes' ? [{ label: heading }] : [])]} />

      <div className="shop__head">
        <h1 className="page-title">{heading}</h1>
        <p className="muted" aria-live="polite">
          {loading && !data ? 'Loading shoes…' : resultsText}
        </p>
      </div>

      <div className="shop__toolbar">
        <Button variant="secondary" className="shop__filter-btn" icon={<SlidersHorizontal size={18} />} onClick={() => setFiltersOpen(true)}>
          Filters{chips.length ? ` (${chips.length})` : ''}
        </Button>
        <div className="shop__sort">
          <label htmlFor="sort">Sort by</label>
          <select id="sort" className="input input--select input--sm" value={query.sort} onChange={(e) => setValue('sort', e.target.value === 'featured' ? undefined : e.target.value)}>
            {(Object.keys(sortLabels) as SortOption[]).map((s) => (
              <option key={s} value={s}>
                {sortLabels[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(chips.length > 0 || query.search) && (
        <div className="chips" aria-label="Applied filters">
          {query.search && (
            <button type="button" className="chip" onClick={() => setValue('q', undefined)}>
              Search: {query.search}
              <X size={14} aria-hidden="true" />
              <span className="visually-hidden">Remove search</span>
            </button>
          )}
          {chips.map((c) => (
            <button key={c.key} type="button" className="chip" onClick={c.remove}>
              {c.label}
              <X size={14} aria-hidden="true" />
              <span className="visually-hidden">Remove filter</span>
            </button>
          ))}
          {chips.length > 0 && (
            <button type="button" className="text-link chips__clear" onClick={clearAll}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      <div className="shop__layout">
        <aside className="shop__sidebar" aria-label="Filters">
          {filterPanel}
        </aside>

        <section className="shop__results" aria-label="Products" aria-busy={loading}>
          {error && <ErrorState message={error} onRetry={reload} />}

          {!error && data && data.totalCount === 0 && (
            <EmptyState
              icon={<SearchX size={32} />}
              title={query.search ? `No shoes match “${query.search}”` : 'No shoes match these filters'}
              action={
                <div className="empty-state__buttons">
                  {chips.length > 0 && <Button onClick={clearAll}>Clear all filters</Button>}
                  {query.search && (
                    <Button variant="secondary" onClick={() => setValue('q', undefined)}>
                      Clear search
                    </Button>
                  )}
                </div>
              }
            >
              {query.search ? 'Check the spelling, or try a brand, a colour or a style such as “running”.' : 'Remove a filter or two to see more shoes.'}
            </EmptyState>
          )}

          <div className={`product-grid${loading && data ? ' is-refreshing' : ''}`}>
            {!data && loading && Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />)}
            {data?.items.map((p) => <ProductCard key={p.id} product={p} highlightSize={highlightSize} />)}
          </div>

          {data && data.totalCount > 0 && (
            <div className="load-more">
              <p className="muted">
                Showing {data.items.length} of {data.totalCount}
              </p>
              <div className="load-more__bar" aria-hidden="true">
                <span style={{ width: `${(data.items.length / data.totalCount) * 100}%` }} />
              </div>
              {data.page < data.totalPages && (
                <Button variant="secondary" loading={loading} onClick={() => setValue('page', String(data.page + 1))}>
                  Load more shoes
                </Button>
              )}
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        variant="drawer-left"
        footer={
          <div className="filters-footer">
            <Button variant="secondary" onClick={clearAll} disabled={chips.length === 0}>
              Clear all
            </Button>
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>
              {data ? `Show ${data.totalCount} ${data.totalCount === 1 ? 'shoe' : 'shoes'}` : 'Show shoes'}
            </Button>
          </div>
        }
      >
        {filterPanel}
      </Dialog>
    </div>
  );
}
