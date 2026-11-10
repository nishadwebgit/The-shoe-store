import { Link } from 'react-router-dom';
import { ErrorState } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminApi, orderStatusLabels, paymentLabels } from '../api';
import { DataTable, FilterSelect, OrderStatusPill, PageHeader, Pagination, PaymentPill, SearchInput } from '../components';
import { formatDateTime, formatLkr } from '../format';
import { useUrlFilters } from '../hooks';
import type { AdminOrderStatus } from '../types';

const tabs: { value: string; label: string; statuses: AdminOrderStatus[] }[] = [
  { value: '', label: 'All', statuses: [] },
  { value: 'pending', label: 'New', statuses: ['pending'] },
  { value: 'confirmed', label: 'Confirmed', statuses: ['confirmed'] },
  { value: 'processing', label: 'Processing', statuses: ['processing'] },
  { value: 'ready-for-dispatch', label: 'Ready for dispatch', statuses: ['ready-for-dispatch'] },
  { value: 'shipped', label: 'Shipped', statuses: ['shipped'] },
  { value: 'delivered', label: 'Delivered', statuses: ['delivered'] },
  { value: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];

export default function OrdersPage() {
  useDocumentTitle('Orders · Owner Portal');
  const [f, setF] = useUrlFilters({ status: '', payment: '', search: '', from: '', to: '', page: '1' });
  const counts = useAsync(() => adminApi.orderCounts(), []);
  const list = useAsync(
    () => adminApi.orders({ status: f.status, payment: f.payment, search: f.search, from: f.from, to: f.to, page: f.page, pageSize: 20 }),
    [f.status, f.payment, f.search, f.from, f.to, f.page],
  );
  const items = list.data?.items ?? [];
  const countFor = (statuses: AdminOrderStatus[]) =>
    counts.data ? (statuses.length === 0 ? counts.data.total : statuses.reduce((s, x) => s + (counts.data!.byStatus[x] ?? 0), 0)) : undefined;

  return (
    <>
      <PageHeader title="Customer orders" description="Confirm, prepare and dispatch orders. Payment status is shown separately and only changes when a payment is confirmed." />

      <div className="ap-tabs ap-tabs--scroll" role="tablist" aria-label="Order status">
        {tabs.map((t) => {
          const active = f.status === t.value;
          const count = countFor(t.statuses);
          return (
            <button key={t.value} type="button" role="tab" aria-selected={active} className={active ? 'is-active' : ''} onClick={() => setF({ status: t.value })}>
              {t.label}
              {count !== undefined && <span className="ap-tabs__count">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="ap-toolbar">
        <SearchInput value={f.search} onChange={(search) => setF({ search })} placeholder="Search order number, customer name, email or phone" />
        <FilterSelect
          label="Payment"
          value={f.payment}
          onChange={(payment) => setF({ payment })}
          options={[{ value: '', label: 'Any payment status' }, ...Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))]}
        />
        <label className="ap-date">
          <span>From</span>
          <input type="date" className="input input--compact" value={f.from} onChange={(e) => setF({ from: e.target.value })} />
        </label>
        <label className="ap-date">
          <span>To</span>
          <input type="date" className="input input--compact" value={f.to} onChange={(e) => setF({ to: e.target.value })} />
        </label>
      </div>

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <>
          <DataTable loading={list.loading} isEmpty={items.length === 0} colSpan={7} empty="No orders match these filters.">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th className="num">Items</th>
                <th className="num">Total</th>
                <th>Payment</th>
                <th>Fulfilment</th>
                <th>Next step</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.orderNumber}>
                  <td>
                    <Link className="ap-strong-link" to={`/admin/orders/${o.orderNumber}`}>
                      {o.orderNumber}
                    </Link>
                    <div className="muted ap-small">{formatDateTime(o.placedAt)}</div>
                  </td>
                  <td>
                    {o.customerName}
                    <div className="muted ap-small">
                      {o.email}
                      {o.isGuest ? ' · guest' : ''}
                    </div>
                  </td>
                  <td className="num">{o.itemCount}</td>
                  <td className="num">{formatLkr(o.total)}</td>
                  <td>
                    <PaymentPill status={o.paymentStatus} orderStatus={o.status} />
                  </td>
                  <td>
                    <OrderStatusPill status={o.status} />
                  </td>
                  <td className="ap-small">
                    {o.nextStatuses.filter((s) => s !== 'cancelled').length > 0 ? (
                      <Link className="text-link" to={`/admin/orders/${o.orderNumber}`}>
                        {orderStatusLabels[o.nextStatuses.find((s) => s !== 'cancelled')!]} →
                      </Link>
                    ) : (
                      <span className="muted">—</span>
                    )}
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
