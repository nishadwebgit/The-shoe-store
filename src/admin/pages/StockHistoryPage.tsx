import { Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { ErrorState, Spinner } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminApi, transactionLabels } from '../api';
import { Change, DataTable, FilterSelect, PageHeader, Pagination, SearchInput, TransactionPill } from '../components';
import { formatDateTime, formatDay, formatLkr } from '../format';
import { useUrlFilters } from '../hooks';

export default function StockHistoryPage() {
  useDocumentTitle('Stock history · Owner Portal');
  const [f, setF] = useUrlFilters({ tab: 'movements', search: '', type: '', from: '', to: '', variant: '', label: '', product: '', receipt: '', page: '1' });

  return (
    <>
      <PageHeader
        title="Stock history"
        description="Every change to stock is recorded here with who made it and why. Records can’t be edited or deleted."
        actions={
          <ButtonLink to="/admin/receive-stock" variant="accent" icon={<Truck size={18} aria-hidden="true" />}>
            Receive stock
          </ButtonLink>
        }
      />
      <div className="ap-tabs" role="tablist" aria-label="History">
        <button type="button" role="tab" aria-selected={f.tab === 'movements'} className={f.tab === 'movements' ? 'is-active' : ''} onClick={() => setF({ tab: 'movements', receipt: '' })}>
          Stock movements
        </button>
        <button type="button" role="tab" aria-selected={f.tab === 'receipts'} className={f.tab === 'receipts' ? 'is-active' : ''} onClick={() => setF({ tab: 'receipts', variant: '', label: '', type: '' })}>
          Stock receipts
        </button>
      </div>

      {(f.variant || f.product) && (
        <p className="ap-filter-note">
          Showing {f.label ? <strong>{f.label}</strong> : f.variant ? 'one size' : 'one product'} only.{' '}
          <button type="button" className="text-link" onClick={() => setF({ variant: '', label: '', product: '' })}>
            Show everything
          </button>
        </p>
      )}

      <div className="ap-toolbar">
        <SearchInput
          value={f.search}
          onChange={(search) => setF({ search })}
          placeholder={f.tab === 'movements' ? 'Search product, SKU, order or receipt number, reason or person' : 'Search receipt, product, supplier or invoice'}
        />
        {f.tab === 'movements' && (
          <FilterSelect
            label="Type"
            value={f.type}
            onChange={(type) => setF({ type })}
            options={[
              { value: '', label: 'All types' },
              ...Object.entries(transactionLabels).map(([value, label]) => ({ value, label })),
              { value: 'correction,damaged,lost,returned', label: 'Manual adjustments' },
            ]}
          />
        )}
        <label className="ap-date">
          <span>From</span>
          <input type="date" className="input input--compact" value={f.from} onChange={(e) => setF({ from: e.target.value })} />
        </label>
        <label className="ap-date">
          <span>To</span>
          <input type="date" className="input input--compact" value={f.to} onChange={(e) => setF({ to: e.target.value })} />
        </label>
      </div>

      {f.tab === 'movements' ? <Movements f={f} setPage={(page) => setF({ page: String(page) })} /> : <Receipts f={f} setF={setF} />}
    </>
  );
}

type Filters = Record<'tab' | 'search' | 'type' | 'from' | 'to' | 'variant' | 'label' | 'product' | 'receipt' | 'page', string>;

function Movements({ f, setPage }: { f: Filters; setPage: (page: number) => void }) {
  const list = useAsync(
    () =>
      adminApi.transactions({
        search: f.search,
        type: f.type,
        from: f.from,
        to: f.to,
        variantId: f.variant,
        productId: f.product,
        page: f.page,
        pageSize: 30,
      }),
    [f.search, f.type, f.from, f.to, f.variant, f.product, f.page],
  );
  if (list.error) return <ErrorState message={list.error} onRetry={list.reload} />;
  const items = list.data?.items ?? [];
  return (
    <>
      <DataTable loading={list.loading} isEmpty={items.length === 0} colSpan={7} empty="No stock movements match these filters.">
        <thead>
          <tr>
            <th>When</th>
            <th>Type</th>
            <th>Item</th>
            <th className="num">Before</th>
            <th className="num">Change</th>
            <th className="num">After</th>
            <th>Reason / reference</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr key={t.id}>
              <td className="ap-small">
                {formatDateTime(t.createdAt)}
                <div className="muted">{t.performedBy}</div>
              </td>
              <td>
                <TransactionPill type={t.type} />
              </td>
              <td>
                {t.productName}
                <div className="muted ap-small">
                  {t.colour} · UK {t.size.replace('K', '')} · <span className="ap-mono">{t.sku}</span>
                </div>
              </td>
              <td className="num">{t.previousQuantity}</td>
              <td className="num">
                <Change value={t.change} />
              </td>
              <td className="num">
                <strong>{t.newQuantity}</strong>
              </td>
              <td className="ap-small">
                {t.reason}
                {t.reference && (
                  <div>
                    {t.reference.startsWith('NS-') ? (
                      <Link className="text-link" to={`/admin/orders/${t.reference}`}>
                        {t.reference}
                      </Link>
                    ) : (
                      <span className="ap-mono">{t.reference}</span>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {list.data && <Pagination page={list.data.page} totalPages={list.data.totalPages} totalCount={list.data.totalCount} onPage={setPage} />}
    </>
  );
}

function Receipts({ f, setF }: { f: Filters; setF: (patch: Partial<Filters>) => void }) {
  const list = useAsync(
    () => adminApi.receipts({ search: f.search, from: f.from, to: f.to, productId: f.product, page: f.page, pageSize: 20 }),
    [f.search, f.from, f.to, f.product, f.page],
  );
  if (list.error) return <ErrorState message={list.error} onRetry={list.reload} />;
  const items = list.data?.items ?? [];
  return (
    <>
      <DataTable loading={list.loading} isEmpty={items.length === 0} colSpan={7} empty="No stock receipts yet. Use “Receive stock” when a delivery arrives.">
        <thead>
          <tr>
            <th>Receipt</th>
            <th>Received</th>
            <th>Product</th>
            <th>Supplier</th>
            <th className="num">Pairs</th>
            <th className="num">Cost</th>
            <th>Recorded by</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id}>
              <td>
                <button type="button" className="text-link ap-strong-link" onClick={() => setF({ receipt: String(r.id), page: f.page })}>
                  {r.receiptNumber}
                </button>
              </td>
              <td>{formatDay(r.receivedDate)}</td>
              <td>
                {r.productId ? (
                  <Link className="text-link" to={`/admin/products/${r.productId}`}>
                    {r.productName}
                  </Link>
                ) : (
                  r.productName
                )}
                <div className="muted ap-small">{r.productCode}</div>
              </td>
              <td>
                {r.supplier ?? '—'}
                {r.supplierReference && <div className="muted ap-small">Invoice {r.supplierReference}</div>}
              </td>
              <td className="num">+{r.totalQuantity}</td>
              <td className="num">{r.totalCost !== null ? formatLkr(r.totalCost) : '—'}</td>
              <td className="ap-small">
                {r.receivedBy}
                <div className="muted">{formatDateTime(r.createdAt)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {list.data && (
        <Pagination page={list.data.page} totalPages={list.data.totalPages} totalCount={list.data.totalCount} onPage={(page) => setF({ page: String(page) })} />
      )}
      {f.receipt && <ReceiptDialog id={Number(f.receipt)} onClose={() => setF({ receipt: '', page: f.page })} />}
    </>
  );
}

function ReceiptDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const receipt = useAsync(() => adminApi.receipt(id), [id]);
  const r = receipt.data;
  return (
    <Dialog open onClose={onClose} title={r ? r.receiptNumber : 'Stock receipt'} size="lg">
      {receipt.loading && !r ? (
        <Spinner label="Loading receipt" />
      ) : receipt.error || !r ? (
        <ErrorState message={receipt.error ?? 'Not found'} onRetry={receipt.reload} />
      ) : (
        <>
          <dl className="ap-dl ap-dl--grid">
            <dt>Product</dt>
            <dd>
              {r.productName} <span className="muted">({r.productCode})</span>
            </dd>
            <dt>Received</dt>
            <dd>{formatDay(r.receivedDate)}</dd>
            <dt>Supplier</dt>
            <dd>{r.supplier ?? '—'}</dd>
            <dt>Invoice / reference</dt>
            <dd>{r.supplierReference ?? '—'}</dd>
            <dt>Cost price</dt>
            <dd>{r.unitCost !== null ? `${formatLkr(r.unitCost)} per pair · ${formatLkr(r.totalCost ?? 0)} total` : '—'}</dd>
            <dt>Selling price</dt>
            <dd>{formatLkr(r.sellingPrice)}</dd>
            <dt>Notes</dt>
            <dd>{r.notes ?? '—'}</dd>
            <dt>Recorded</dt>
            <dd>
              {formatDateTime(r.createdAt)} by {r.receivedBy}
            </dd>
          </dl>
          <DataTable colSpan={5}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Colour / size</th>
                <th className="num">Before</th>
                <th className="num">Received</th>
                <th className="num">After</th>
              </tr>
            </thead>
            <tbody>
              {r.lines.map((l) => (
                <tr key={l.sku}>
                  <td className="ap-mono ap-small">{l.sku}</td>
                  <td>
                    {l.colour} · UK {l.size.replace('K', '')}
                  </td>
                  <td className="num">{l.previousQuantity}</td>
                  <td className="num">
                    <Change value={l.quantity} />
                  </td>
                  <td className="num">
                    <strong>{l.newQuantity}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </>
      )}
    </Dialog>
  );
}
