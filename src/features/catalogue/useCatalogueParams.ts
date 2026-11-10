import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Gender, ProductQuery, SortOption, StyleCategory } from '../../types';

/**
 * Catalogue state lives in the URL so filters survive refresh, can be shared,
 * and the browser Back button returns shoppers to the same filtered list.
 */
const listParams = ['gender', 'category', 'brand', 'size', 'colour'] as const;
export type ListParam = (typeof listParams)[number];

const sortOptions: SortOption[] = ['featured', 'newest', 'popular', 'price-asc', 'price-desc', 'rating'];

export function useCatalogueParams() {
  const [params, setParams] = useSearchParams();

  const list = useCallback((key: ListParam) => (params.get(key) ?? '').split(',').filter(Boolean), [params]);
  const num = useCallback((key: string) => {
    const raw = params.get(key);
    if (raw === null || raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }, [params]);

  const query: ProductQuery = useMemo(() => {
    const sort = params.get('sort') as SortOption | null;
    const collection = params.get('collection');
    return {
      search: params.get('q') ?? undefined,
      genders: list('gender') as Gender[],
      categories: list('category') as StyleCategory[],
      brands: list('brand'),
      sizes: list('size'),
      colours: list('colour'),
      minPrice: num('min'),
      maxPrice: num('max'),
      minRating: num('rating'),
      inStockOnly: params.get('stock') === '1',
      onSaleOnly: params.get('sale') === '1',
      collection: collection === 'new' || collection === 'best-sellers' || collection === 'featured' ? collection : undefined,
      sort: sort && sortOptions.includes(sort) ? sort : collection === 'new' ? 'newest' : 'featured',
      page: Math.max(1, num('page') ?? 1),
    };
  }, [params, list, num]);

  const update = useCallback(
    (mutate: (next: URLSearchParams) => void, options: { resetPage?: boolean } = { resetPage: true }) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          if (options.resetPage) next.delete('page');
          return next;
        },
        { replace: false, preventScrollReset: true },
      );
    },
    [setParams],
  );

  const toggleValue = useCallback(
    (key: ListParam, value: string) =>
      update((next) => {
        const current = (next.get(key) ?? '').split(',').filter(Boolean);
        const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
        if (updated.length) next.set(key, updated.join(','));
        else next.delete(key);
      }),
    [update],
  );

  const setValue = useCallback(
    (key: string, value: string | undefined) =>
      update((next) => {
        if (value === undefined || value === '') next.delete(key);
        else next.set(key, value);
      }, { resetPage: key !== 'page' }),
    [update],
  );

  const clearAll = useCallback(
    () =>
      update((next) => {
        for (const key of [...listParams, 'min', 'max', 'rating', 'stock', 'sale', 'collection']) next.delete(key);
      }),
    [update],
  );

  return { query, params, toggleValue, setValue, update, clearAll };
}
