import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, Star } from 'lucide-react';
import { Checkbox } from '../../components/ui/FormField';
import type { FacetValue, ProductFacets, ProductQuery } from '../../types';
import type { ListParam } from './useCatalogueParams';

interface Props {
  facets: ProductFacets;
  query: ProductQuery;
  toggleValue: (key: ListParam, value: string) => void;
  setValue: (key: string, value: string | undefined) => void;
  update: (mutate: (next: URLSearchParams) => void) => void;
  preferredSize: string | null;
}

function Group({ title, children, defaultOpen = true, count }: { title: string; children: ReactNode; defaultOpen?: boolean; count?: number }) {
  return (
    <details className="filter-group" open={defaultOpen}>
      <summary>
        <span>
          {title}
          {count ? <span className="filter-group__count"> ({count})</span> : null}
        </span>
        <ChevronDown size={18} aria-hidden="true" className="filter-group__chevron" />
      </summary>
      <div className="filter-group__body">{children}</div>
    </details>
  );
}

function CheckList({ name, values, selected, onToggle }: { name: ListParam; values: FacetValue[]; selected: string[]; onToggle: (k: ListParam, v: string) => void }) {
  return (
    <ul className="check-list">
      {values.map((v) => {
        const checked = selected.includes(v.value);
        return (
          <li key={v.value}>
            <Checkbox
              checked={checked}
              disabled={!checked && v.count === 0}
              onChange={() => onToggle(name, v.value)}
              label={
                <>
                  {v.label} <span className="muted">({v.count})</span>
                </>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

function SizeButtons({ values, selected, onToggle, preferred }: { values: FacetValue[]; selected: string[]; onToggle: (v: string) => void; preferred: string | null }) {
  return (
    <div className="filter-sizes">
      {values.map((v) => {
        const on = selected.includes(v.value);
        return (
          <button
            key={v.value}
            type="button"
            className={`filter-size${on ? ' is-selected' : ''}${v.value === preferred ? ' is-preferred' : ''}`}
            aria-pressed={on}
            disabled={!on && v.count === 0}
            onClick={() => onToggle(v.value)}
            aria-label={`UK ${v.label}${v.count === 0 ? ', no matching shoes' : `, ${v.count} shoes`}`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

const pricePresets = [
  { label: 'Under LKR 10,000', min: undefined, max: 9999 },
  { label: 'LKR 10,000 – 20,000', min: 10000, max: 20000 },
  { label: 'LKR 20,000 – 30,000', min: 20000, max: 30000 },
  { label: 'Over LKR 30,000', min: 30000, max: undefined },
];

function PriceFilter({ query, update, range }: { query: ProductQuery; update: Props['update']; range: ProductFacets['priceRange'] }) {
  const [min, setMin] = useState(query.minPrice?.toString() ?? '');
  const [max, setMax] = useState(query.maxPrice?.toString() ?? '');
  const [error, setError] = useState<string>();
  const uid = useId();

  const apply = (e: FormEvent) => {
    e.preventDefault();
    const lo = min ? Number(min) : undefined;
    const hi = max ? Number(max) : undefined;
    if ((lo !== undefined && (!Number.isFinite(lo) || lo < 0)) || (hi !== undefined && (!Number.isFinite(hi) || hi < 0))) {
      setError('Enter prices as whole numbers.');
      return;
    }
    if (lo !== undefined && hi !== undefined && lo > hi) {
      setError('The minimum price must be lower than the maximum.');
      return;
    }
    setError(undefined);
    update((next) => {
      if (lo !== undefined) next.set('min', String(lo));
      else next.delete('min');
      if (hi !== undefined) next.set('max', String(hi));
      else next.delete('max');
    });
  };

  const setPreset = (lo?: number, hi?: number) =>
    update((next) => {
      if (lo !== undefined) next.set('min', String(lo));
      else next.delete('min');
      if (hi !== undefined) next.set('max', String(hi));
      else next.delete('max');
    });

  return (
    <div>
      <ul className="check-list">
        {pricePresets.map((p) => {
          const active = query.minPrice === p.min && query.maxPrice === p.max;
          return (
            <li key={p.label}>
              <label className="radio">
                <input type="radio" name={`${uid}-price`} checked={active} onChange={() => setPreset(p.min, p.max)} />
                <span className="radio__dot" aria-hidden="true" />
                <span>{p.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <form className="price-range" onSubmit={apply} noValidate>
        <label>
          <span className="visually-hidden">Minimum price in LKR</span>
          <input className="input input--sm" inputMode="numeric" placeholder={`Min ${range.min.toLocaleString('en-LK')}`} value={min} onChange={(e) => setMin(e.target.value.replace(/[^\d]/g, ''))} />
        </label>
        <span aria-hidden="true">to</span>
        <label>
          <span className="visually-hidden">Maximum price in LKR</span>
          <input className="input input--sm" inputMode="numeric" placeholder={`Max ${range.max.toLocaleString('en-LK')}`} value={max} onChange={(e) => setMax(e.target.value.replace(/[^\d]/g, ''))} />
        </label>
        <button type="submit" className="btn btn--secondary btn--sm">
          <span>Apply</span>
        </button>
      </form>
      {error && <p className="field__error">{error}</p>}
    </div>
  );
}

export function FilterPanel({ facets, query, toggleValue, setValue, update, preferredSize }: Props) {
  const uid = useId();
  const sizes = query.sizes ?? [];
  const showKids = (query.genders ?? []).includes('kids') || (query.genders ?? []).length === 0;
  const showAdult = !((query.genders ?? []).length === 1 && query.genders?.[0] === 'kids');

  return (
    <div className="filters">
      <Group title="Size (UK)" count={sizes.length}>
        {showAdult && (
          <>
            <p className="filter-sub">Adults</p>
            <SizeButtons values={facets.sizes.adult} selected={sizes} onToggle={(v) => toggleValue('size', v)} preferred={preferredSize} />
          </>
        )}
        {showKids && (
          <>
            <p className="filter-sub">Kids</p>
            <SizeButtons values={facets.sizes.kids} selected={sizes} onToggle={(v) => toggleValue('size', v)} preferred={preferredSize} />
          </>
        )}
        <p className="filter-note muted">Shows shoes with your size in stock.</p>
      </Group>
      <Group title="Gender" count={query.genders?.length}>
        <CheckList name="gender" values={facets.genders} selected={query.genders ?? []} onToggle={toggleValue} />
      </Group>
      <Group title="Category" count={query.categories?.length}>
        <CheckList name="category" values={facets.categories} selected={query.categories ?? []} onToggle={toggleValue} />
      </Group>
      <Group title="Brand" count={query.brands?.length}>
        <CheckList name="brand" values={facets.brands} selected={query.brands ?? []} onToggle={toggleValue} />
      </Group>
      <Group title="Colour" count={query.colours?.length}>
        <div className="filter-colours">
          {facets.colours.map((c) => {
            const on = (query.colours ?? []).includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                className={`filter-colour${on ? ' is-selected' : ''}`}
                aria-pressed={on}
                disabled={!on && c.count === 0}
                onClick={() => toggleValue('colour', c.value)}
              >
                <span className="filter-colour__dot" style={{ background: c.swatch }} aria-hidden="true" />
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>
      </Group>
      <Group title="Price" defaultOpen={false} count={query.minPrice !== undefined || query.maxPrice !== undefined ? 1 : 0}>
        <PriceFilter key={`${query.minPrice}-${query.maxPrice}`} query={query} update={update} range={facets.priceRange} />
      </Group>
      <Group title="Rating" defaultOpen={false} count={query.minRating ? 1 : 0}>
        <ul className="check-list">
          {[4.5, 4, 3].map((r) => (
            <li key={r}>
              <label className="radio">
                <input type="radio" name={`${uid}-rating`} checked={query.minRating === r} onChange={() => setValue('rating', String(r))} />
                <span className="radio__dot" aria-hidden="true" />
                <span className="rating-option">
                  {r} <Star size={14} aria-hidden="true" /> and up
                </span>
              </label>
            </li>
          ))}
          {query.minRating !== undefined && (
            <li>
              <button type="button" className="text-link" onClick={() => setValue('rating', undefined)}>
                Any rating
              </button>
            </li>
          )}
        </ul>
      </Group>
      <Group title="Availability" defaultOpen={false} count={(query.inStockOnly ? 1 : 0) + (query.onSaleOnly ? 1 : 0)}>
        <ul className="check-list">
          <li>
            <Checkbox checked={Boolean(query.inStockOnly)} onChange={(e) => setValue('stock', e.target.checked ? '1' : undefined)} label="In stock only" />
          </li>
          <li>
            <Checkbox checked={Boolean(query.onSaleOnly)} onChange={(e) => setValue('sale', e.target.checked ? '1' : undefined)} label="On sale" />
          </li>
        </ul>
      </Group>
    </div>
  );
}
