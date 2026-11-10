import { useState } from 'react';
import { Plus, Star, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../hooks/useStore';
import { errorMessage } from '../../utils/errors';
import { adminApi } from '../api';
import { DataTable, FilterSelect, PageHeader, Pagination, Pill, SearchInput, Thumb } from '../components';
import { formatDay, formatLkr } from '../format';
import { useUrlFilters } from '../hooks';
import type { AdminProductListItem } from '../types';

export default function ProductsPage() {
  useDocumentTitle('Products · Owner Portal');
  const { notify } = useToast();
  const [f, setF] = useUrlFilters({ search: '', brand: '', category: '', status: '', stock: '', sort: 'updated', page: '1' });
  const lookups = useAsync(() => adminApi.lookups(), []);
  const list = useAsync(
    () =>
      adminApi.products({
        search: f.search,
        brandId: f.brand,
        category: f.category,
        status: f.status,
        stock: f.stock,
        sort: f.sort,
        page: f.page,
        pageSize: 20,
      }),
    [f.search, f.brand, f.category, f.status, f.stock, f.sort, f.page],
  );
  const [overrides, setOverrides] = useState<Record<number, Partial<AdminProductListItem>>>({});
  const [busy, setBusy] = useState<number>();

  const toggle = async (p: AdminProductListItem, change: { isActive?: boolean; isFeatured?: boolean }) => {
    setBusy(p.id);
    try {
      const updated = await adminApi.setProductStatus(p.id, change);
      setOverrides((o) => ({ ...o, [p.id]: { isActive: updated.isActive, isFeatured: updated.isFeatured } }));
      notify(
        change.isActive !== undefined
          ? `${p.name} is now ${updated.isActive ? 'visible in the shop' : 'hidden from the shop'}.`
          : `${p.name} ${updated.isFeatured ? 'is featured' : 'is no longer featured'}.`,
        'success',
      );
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setBusy(undefined);
    }
  };

  const items = (list.data?.items ?? []).map((p) => ({ ...p, ...overrides[p.id] }));

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything in your catalogue, including products hidden from the shop."
        actions={
          <ButtonLink to="/admin/products/new" variant="accent" icon={<Plus size={18} aria-hidden="true" />}>
            Add new product
          </ButtonLink>
        }
      />

      <div className="ap-toolbar">
        <SearchInput value={f.search} onChange={(search) => setF({ search })} placeholder="Search name, code, SKU, brand or category" />
        <FilterSelect
          label="Brand"
          value={f.brand}
          onChange={(brand) => setF({ brand })}
          options={[{ value: '', label: 'All brands' }, ...(lookups.data?.brands ?? []).map((b) => ({ value: String(b.id), label: b.name }))]}
        />
        <FilterSelect
          label="Category"
          value={f.category}
          onChange={(category) => setF({ category })}
          options={[{ value: '', label: 'All categories' }, ...(lookups.data?.categories ?? []).map((c) => ({ value: c.code, label: c.name }))]}
        />
        <FilterSelect
          label="Availability"
          value={f.stock}
          onChange={(stock) => setF({ stock })}
          options={[
            { value: '', label: 'Any stock' },
            { value: 'in', label: 'In stock' },
            { value: 'low', label: 'Low stock' },
            { value: 'out', label: 'Out of stock' },
          ]}
        />
        <FilterSelect
          label="Status"
          value={f.status}
          onChange={(status) => setF({ status })}
          options={[
            { value: '', label: 'Active and inactive' },
            { value: 'active', label: 'Active only' },
            { value: 'inactive', label: 'Inactive only' },
          ]}
        />
        <FilterSelect
          label="Sort"
          value={f.sort}
          onChange={(sort) => setF({ sort })}
          options={[
            { value: 'updated', label: 'Recently updated' },
            { value: 'name', label: 'Name A–Z' },
            { value: 'code', label: 'Product code' },
            { value: 'price', label: 'Price, low to high' },
            { value: 'stock', label: 'Stock, lowest first' },
          ]}
        />
      </div>

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <>
          <DataTable loading={list.loading} isEmpty={items.length === 0} colSpan={8} empty="No products match these filters.">
            <thead>
              <tr>
                <th>Product</th>
                <th>Brand / category</th>
                <th className="num">Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Featured</th>
                <th>Updated</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className={p.isActive ? '' : 'is-muted'}>
                  <td>
                    <div className="ap-product-cell">
                      <Thumb src={p.image} alt="" />
                      <div>
                        <Link className="ap-strong-link" to={`/admin/products/${p.id}`}>
                          {p.name}
                        </Link>
                        <div className="muted ap-small">
                          {p.code} · {p.gender}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {p.brand}
                    <div className="muted ap-small">{p.categories.join(', ')}</div>
                  </td>
                  <td className="num">
                    {formatLkr(p.price)}
                    {p.originalPrice && <div className="muted ap-small ap-strike">{formatLkr(p.originalPrice)}</div>}
                  </td>
                  <td>
                    <strong>{p.totalStock}</strong> <span className="muted ap-small">pairs</span>
                    <div className="ap-stack ap-stack--row">
                      {p.totalStock === 0 ? (
                        <Pill tone="danger">Out of stock</Pill>
                      ) : (
                        <>
                          {p.lowStockVariants > 0 && <Pill tone="warn">{p.lowStockVariants} low</Pill>}
                          {p.outOfStockVariants > 0 && <Pill tone="neutral">{p.outOfStockVariants} sold out</Pill>}
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <label className="ap-switch">
                      <input
                        type="checkbox"
                        checked={p.isActive}
                        disabled={busy === p.id}
                        onChange={(e) => toggle(p, { isActive: e.target.checked })}
                      />
                      <span className="ap-switch__track" aria-hidden="true" />
                      <span className="ap-switch__label">{p.isActive ? 'Active' : 'Inactive'}</span>
                    </label>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={`icon-button ap-star${p.isFeatured ? ' is-on' : ''}`}
                      aria-pressed={p.isFeatured}
                      aria-label={p.isFeatured ? `Unfeature ${p.name}` : `Feature ${p.name}`}
                      disabled={busy === p.id}
                      onClick={() => toggle(p, { isFeatured: !p.isFeatured })}
                    >
                      <Star size={18} />
                    </button>
                  </td>
                  <td className="ap-small">{formatDay(p.updatedAt ?? p.createdAt)}</td>
                  <td className="ap-actions">
                    <Link className="text-link" to={`/admin/products/${p.id}`}>
                      Edit
                    </Link>
                    <Link className="text-link text-link--icon" to={`/admin/receive-stock?product=${p.id}`} title="Receive stock for this product">
                      <Truck size={16} aria-hidden="true" /> Receive
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {list.data && (
            <Pagination page={list.data.page} totalPages={list.data.totalPages} totalCount={list.data.totalCount} onPage={(page) => setF({ page: String(page) })} />
          )}
        </>
      )}
    </>
  );
}
