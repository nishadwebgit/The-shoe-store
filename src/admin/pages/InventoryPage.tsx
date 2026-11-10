import { useState } from 'react';
import { History, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { ErrorState } from '../../components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '../../components/ui/FormField';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../hooks/useStore';
import { errorMessage } from '../../utils/errors';
import { adminApi } from '../api';
import { DataTable, FilterSelect, PageHeader, Pagination, Pill, SearchInput, StockPill, Thumb } from '../components';
import { formatDateTime } from '../format';
import { useUrlFilters } from '../hooks';
import type { AdjustmentType, InventoryItem } from '../types';

export default function InventoryPage() {
  useDocumentTitle('Inventory · Owner Portal');
  const [f, setF] = useUrlFilters({ search: '', brand: '', category: '', stock: '', size: '', product: '', sort: 'product', page: '1' });
  const lookups = useAsync(() => adminApi.lookups(), []);
  const list = useAsync(
    () =>
      adminApi.inventory({
        search: f.search,
        brandId: f.brand,
        category: f.category,
        stock: f.stock,
        size: f.size,
        productId: f.product,
        sort: f.sort,
        page: f.page,
        pageSize: 25,
      }),
    [f.search, f.brand, f.category, f.stock, f.size, f.product, f.sort, f.page],
  );
  const [updated, setUpdated] = useState<Record<number, InventoryItem>>({});
  const [adjusting, setAdjusting] = useState<InventoryItem>();
  const [thresholdFor, setThresholdFor] = useState<InventoryItem>();
  const items = (list.data?.items ?? []).map((i) => updated[i.variantId] ?? i);
  const productName = f.product ? items[0]?.productName : undefined;

  return (
    <>
      <PageHeader
        title="Inventory"
        description={
          <>
            Stock for every product, colour and size. “Held” pairs are reserved by orders waiting for card payment. Low stock means at or below
            the threshold (store default: {lookups.data?.lowStockThreshold ?? '…'}).
          </>
        }
      />

      {f.product && (
        <p className="ap-filter-note">
          Showing {productName ?? 'one product'} only.{' '}
          <button type="button" className="text-link" onClick={() => setF({ product: '' })}>
            Show all products
          </button>
        </p>
      )}

      <div className="ap-toolbar">
        <SearchInput value={f.search} onChange={(search) => setF({ search })} placeholder="Search product, SKU, brand or colour" />
        <FilterSelect
          label="Stock level"
          value={f.stock}
          onChange={(stock) => setF({ stock })}
          options={[
            { value: '', label: 'All stock levels' },
            { value: 'in', label: 'In stock' },
            { value: 'low', label: 'Low stock' },
            { value: 'out', label: 'Out of stock' },
          ]}
        />
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
          label="Size"
          value={f.size}
          onChange={(size) => setF({ size })}
          options={[{ value: '', label: 'All sizes' }, ...(lookups.data?.sizes ?? []).map((s) => ({ value: s.code, label: `UK ${s.label}${s.sizeSystem === 'kids' ? ' (kids)' : ''}` }))]}
        />
        <FilterSelect
          label="Sort"
          value={f.sort}
          onChange={(sort) => setF({ sort })}
          options={[
            { value: 'product', label: 'Product, colour, size' },
            { value: 'stock-asc', label: 'Lowest stock first' },
            { value: 'stock-desc', label: 'Highest stock first' },
            { value: 'updated', label: 'Recently updated' },
          ]}
        />
      </div>

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <>
          <DataTable loading={list.loading} isEmpty={items.length === 0} colSpan={8} empty="No stock matches these filters.">
            <thead>
              <tr>
                <th>Product</th>
                <th>Colour / size</th>
                <th>SKU</th>
                <th className="num">Available</th>
                <th className="num">Held</th>
                <th>Level</th>
                <th>Last update</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.variantId} className={i.productActive ? '' : 'is-muted'}>
                  <td>
                    <div className="ap-product-cell">
                      <Thumb src={i.image} alt="" />
                      <div>
                        <Link className="ap-strong-link" to={`/admin/products/${i.productId}`}>
                          {i.productName}
                        </Link>
                        <div className="muted ap-small">
                          {i.productCode} · {i.brand}
                          {!i.productActive && ' · inactive'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="ap-swatch" style={{ background: i.swatch }} aria-hidden="true" /> {i.colour}
                    <div className="muted ap-small">UK {i.size.replace('K', '')}{i.size.endsWith('K') ? ' kids' : ''}</div>
                  </td>
                  <td className="ap-mono ap-small">{i.sku}</td>
                  <td className="num">
                    <strong className="ap-big-num">{i.available}</strong>
                  </td>
                  <td className="num">{i.held > 0 ? <Pill tone="warn">{i.held}</Pill> : <span className="muted">0</span>}</td>
                  <td>
                    <StockPill state={i.stockState} />
                    <button type="button" className="ap-threshold" onClick={() => setThresholdFor(i)} title="Change this size’s low-stock threshold">
                      alert at ≤ {i.effectiveThreshold}
                      {i.lowStockThreshold === null ? '' : ' (custom)'}
                    </button>
                  </td>
                  <td className="ap-small">{formatDateTime(i.lastUpdated)}</td>
                  <td className="ap-actions">
                    <Button size="sm" variant="secondary" icon={<SlidersHorizontal size={15} aria-hidden="true" />} onClick={() => setAdjusting(i)}>
                      Adjust
                    </Button>
                    <Link className="text-link text-link--icon" to={`/admin/stock-history?variant=${i.variantId}&label=${encodeURIComponent(i.sku)}`}>
                      <History size={15} aria-hidden="true" /> History
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

      {adjusting && (
        <AdjustDialog
          item={adjusting}
          onClose={() => setAdjusting(undefined)}
          onDone={(item) => {
            setUpdated((u) => ({ ...u, [item.variantId]: item }));
            setAdjusting(undefined);
          }}
        />
      )}
      {thresholdFor && (
        <ThresholdDialog
          item={thresholdFor}
          storeDefault={lookups.data?.lowStockThreshold ?? 3}
          onClose={() => setThresholdFor(undefined)}
          onDone={(item) => {
            setUpdated((u) => ({ ...u, [item.variantId]: item }));
            setThresholdFor(undefined);
          }}
        />
      )}
    </>
  );
}

const adjustmentTypes: { value: string; type: AdjustmentType; sign: 1 | -1; label: string; hint: string }[] = [
  { value: 'damaged', type: 'damaged', sign: -1, label: 'Damaged: remove from stock', hint: 'Pairs that can’t be sold.' },
  { value: 'lost', type: 'lost', sign: -1, label: 'Lost or missing: remove from stock', hint: 'Pairs you can’t find during a count.' },
  { value: 'returned', type: 'returned', sign: 1, label: 'Customer return: add back to stock', hint: 'Returned pairs in sellable condition.' },
  { value: 'correction-add', type: 'correction', sign: 1, label: 'Stock count correction: add', hint: 'You counted more than the system shows.' },
  { value: 'correction-remove', type: 'correction', sign: -1, label: 'Stock count correction: remove', hint: 'You counted fewer than the system shows.' },
];

function AdjustDialog({ item, onClose, onDone }: { item: InventoryItem; onClose: () => void; onDone: (item: InventoryItem) => void }) {
  const { notify } = useToast();
  const [kind, setKind] = useState('damaged');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ quantity?: string; reason?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);
  const option = adjustmentTypes.find((t) => t.value === kind)!;
  const amount = Number(quantity) || 0;
  const change = option.sign * amount;
  const result = item.available + change;

  const submit = async () => {
    const e: typeof errors = {};
    if (!/^\d+$/.test(quantity) || amount < 1) e.quantity = 'Enter a whole number of pairs, 1 or more.';
    else if (result < 0) e.quantity = `Only ${item.available} in stock, so you can remove at most ${item.available}.`;
    if (reason.trim().length < 3) e.reason = 'Explain what happened. This is kept in the stock history.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res = await adminApi.adjustStock(item.variantId, { type: option.type, change, reason: reason.trim() });
      notify(`${item.sku}: ${res.transaction.previousQuantity} → ${res.transaction.newQuantity}. Recorded in stock history.`, 'success');
      onDone(res.item);
    } catch (err) {
      setErrors({ form: errorMessage(err) });
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Adjust stock"
      footer={
        <div className="ap-dialog-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} loading={busy}>
            Save adjustment
          </Button>
        </div>
      }
    >
      <p>
        <strong>{item.productName}</strong>
        <br />
        <span className="muted">
          {item.colour} · UK {item.size.replace('K', '')} · {item.sku}
        </span>
      </p>
      <SelectField label="What happened?" value={kind} onChange={(e) => setKind(e.target.value)} hint={option.hint}>
        {adjustmentTypes.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </SelectField>
      <TextField label="Number of pairs" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, '').slice(0, 5))} error={errors.quantity} />
      <TextAreaField
        label="Reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={errors.reason}
        rows={3}
        maxLength={300}
        hint="Required. For example: “Water damage in storeroom” or “Monthly count, 12 Nov”."
      />
      <div className="ap-adjust-preview" aria-live="polite">
        <span>Now {item.available}</span>
        <span className={change >= 0 ? 'ap-change ap-change--up' : 'ap-change ap-change--down'}>{change >= 0 ? `+${change}` : change}</span>
        <strong className={result < 0 ? 'ap-text-danger' : ''}>After {result}</strong>
      </div>
      {errors.form && (
        <p className="ap-alert ap-alert--danger" role="alert">
          {errors.form}
        </p>
      )}
    </Dialog>
  );
}

function ThresholdDialog({ item, storeDefault, onClose, onDone }: { item: InventoryItem; storeDefault: number; onClose: () => void; onDone: (item: InventoryItem) => void }) {
  const { notify } = useToast();
  const [useDefault, setUseDefault] = useState(item.lowStockThreshold === null);
  const [value, setValue] = useState(String(item.lowStockThreshold ?? storeDefault));
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!useDefault && (!/^\d+$/.test(value) || Number(value) > 1000)) return setError('Enter a whole number from 0 to 1,000.');
    setBusy(true);
    try {
      const updated = await adminApi.setThreshold(item.variantId, useDefault ? null : Number(value));
      notify('Low-stock threshold saved.', 'success');
      onDone(updated);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Low-stock threshold"
      size="sm"
      footer={
        <div className="ap-dialog-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save} loading={busy}>
            Save
          </Button>
        </div>
      }
    >
      <p className="muted">
        {item.productName} · {item.colour} · UK {item.size.replace('K', '')}
      </p>
      <fieldset className="ap-radio-group">
        <legend className="visually-hidden">Threshold</legend>
        <label>
          <input type="radio" checked={useDefault} onChange={() => setUseDefault(true)} /> Use the store default ({storeDefault})
        </label>
        <label>
          <input type="radio" checked={!useDefault} onChange={() => setUseDefault(false)} /> Custom threshold for this size
        </label>
      </fieldset>
      {!useDefault && (
        <TextField label="Show as low stock at or below" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} error={error} />
      )}
      {useDefault && error && <p className="field__error">{error}</p>}
    </Dialog>
  );
}
