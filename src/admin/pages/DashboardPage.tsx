import { AlertTriangle, Boxes, ClipboardList, PackageX, ShoppingBag, Truck, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../../components/ui/Button';
import { ErrorState, Spinner } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminApi } from '../api';
import { BarChart, Change, DataTable, OrderStatusPill, PageHeader, Panel, PaymentPill, StatCard, StockPill, Thumb, TransactionPill } from '../components';
import { formatDateTime, formatDay, formatLkr } from '../format';

export default function DashboardPage() {
  useDocumentTitle('Owner Portal');
  const { data, error, loading, reload } = useAsync(() => adminApi.dashboard(), []);

  if (loading && !data) return <Spinner label="Loading the dashboard" />;
  if (error || !data) return <ErrorState message={error ?? 'The dashboard couldn’t load.'} onRetry={reload} />;

  const { products, stock, orders, sales } = data;
  const chart = data.daily.map((d) => ({
    label: new Intl.DateTimeFormat('en-GB', { day: 'numeric' }).format(new Date(d.date)),
    value: d.revenue,
    title: `${formatDay(d.date)}: ${d.orders} order${d.orders === 1 ? '' : 's'}, ${formatLkr(d.revenue)}`,
  }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Today’s view of your products, stock and orders."
        actions={
          <>
            <ButtonLink to="/admin/receive-stock" variant="accent" icon={<Truck size={18} aria-hidden="true" />}>
              Receive stock
            </ButtonLink>
            <ButtonLink to="/admin/products/new" variant="secondary">
              Add product
            </ButtonLink>
          </>
        }
      />

      <div className="ap-stats">
        <StatCard label="Products" value={products.total} hint={`${products.active} active · ${products.inactive} inactive`} icon={<ShoppingBag size={20} />} />
        <StatCard label="Pairs in stock" value={stock.totalUnits.toLocaleString()} hint={`+${stock.receivedLast7Days} received in the last 7 days`} icon={<Boxes size={20} />} />
        <StatCard
          label="Low stock"
          value={stock.lowStockVariants}
          hint="sizes at or below their threshold"
          tone={stock.lowStockVariants > 0 ? 'warn' : 'default'}
          icon={<AlertTriangle size={20} />}
        />
        <StatCard
          label="Out of stock"
          value={stock.outOfStockProducts}
          hint={`products · ${stock.outOfStockVariants} sizes sold out`}
          tone={stock.outOfStockProducts > 0 ? 'danger' : 'default'}
          icon={<PackageX size={20} />}
        />
      </div>

      <div className="ap-stats">
        <StatCard label="New orders" value={orders.pending} hint="waiting for you to confirm" tone={orders.pending > 0 ? 'warn' : 'default'} icon={<ClipboardList size={20} />} />
        <StatCard label="Being processed" value={orders.inProgress + orders.readyForDispatch} hint={`${orders.readyForDispatch} ready for dispatch`} />
        <StatCard label="Completed" value={orders.completed} hint={`${orders.shipped} on the way · ${orders.cancelled} cancelled`} tone="good" />
        <StatCard
          label="Sales, last 30 days"
          value={formatLkr(sales.revenueLast30Days)}
          hint={`${sales.ordersLast30Days} paid orders · avg ${formatLkr(sales.averageOrderValue)}`}
          icon={<Wallet size={20} />}
        />
      </div>

      <div className="ap-grid ap-grid--2-1">
        <Panel title="Sales, last 14 days" actions={<span className="muted ap-small">Paid and demo orders, excluding cancelled</span>}>
          <BarChart data={chart} format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
        </Panel>
        <Panel title="Orders needing attention">
          <ul className="ap-kv">
            <li>
              <Link to="/admin/orders?status=pending">New (pending)</Link>
              <strong>{orders.pending}</strong>
            </li>
            <li>
              <Link to="/admin/orders?status=confirmed,processing">Confirmed or processing</Link>
              <strong>{orders.inProgress}</strong>
            </li>
            <li>
              <Link to="/admin/orders?status=ready-for-dispatch">Ready for dispatch</Link>
              <strong>{orders.readyForDispatch}</strong>
            </li>
            <li>
              <Link to="/admin/orders?payment=pending">Awaiting card payment</Link>
              <strong>{orders.awaitingPayment}</strong>
            </li>
            <li>
              <Link to="/admin/orders">All orders</Link>
              <strong>{orders.total}</strong>
            </li>
          </ul>
        </Panel>
      </div>

      <div className="ap-grid ap-grid--2">
        <Panel title="Recent orders" actions={<Link className="text-link" to="/admin/orders">View all</Link>}>
          <DataTable isEmpty={data.recentOrders.length === 0} empty="No orders yet." colSpan={4}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Status</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((o) => (
                <tr key={o.orderNumber}>
                  <td>
                    <Link className="ap-strong-link" to={`/admin/orders/${o.orderNumber}`}>
                      {o.orderNumber}
                    </Link>
                    <div className="muted ap-small">{formatDateTime(o.placedAt)}</div>
                  </td>
                  <td>{o.customerName}</td>
                  <td>
                    <div className="ap-stack">
                      <OrderStatusPill status={o.status} />
                      <PaymentPill status={o.paymentStatus} orderStatus={o.status} />
                    </div>
                  </td>
                  <td className="num">{formatLkr(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>

        <Panel title="Low and out of stock" actions={<Link className="text-link" to="/admin/inventory?stock=low">View inventory</Link>}>
          <DataTable isEmpty={data.lowStock.length === 0} empty="Every active size is above its low-stock threshold." colSpan={3}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Size</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {data.lowStock.map((i) => (
                <tr key={i.variantId}>
                  <td>
                    <div className="ap-product-cell">
                      <Thumb src={i.image} alt="" />
                      <div>
                        <Link className="ap-strong-link" to={`/admin/inventory?product=${i.productId}`}>
                          {i.productName}
                        </Link>
                        <div className="muted ap-small">
                          {i.colour} · {i.sku}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>UK {i.size.replace('K', '')}</td>
                  <td>
                    <StockPill state={i.stockState} quantity={i.available} />
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
      </div>

      <div className="ap-grid ap-grid--2">
        <Panel title="Newly received stock" actions={<Link className="text-link" to="/admin/stock-history?tab=receipts">All receipts</Link>}>
          <DataTable isEmpty={data.recentReceipts.length === 0} empty="No stock received through the portal yet." colSpan={3}>
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Product</th>
                <th className="num">Pairs</th>
              </tr>
            </thead>
            <tbody>
              {data.recentReceipts.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link className="ap-strong-link" to={`/admin/stock-history?tab=receipts&receipt=${r.id}`}>
                      {r.receiptNumber}
                    </Link>
                    <div className="muted ap-small">
                      {formatDay(r.receivedDate)}
                      {r.supplier ? ` · ${r.supplier}` : ''}
                    </div>
                  </td>
                  <td>{r.productName}</td>
                  <td className="num">+{r.totalQuantity}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>

        <Panel title="Recent inventory updates" actions={<Link className="text-link" to="/admin/stock-history">Stock history</Link>}>
          <DataTable isEmpty={data.recentMovements.length === 0} empty="No stock movements yet." colSpan={3}>
            <thead>
              <tr>
                <th>When</th>
                <th>Item</th>
                <th className="num">Change</th>
              </tr>
            </thead>
            <tbody>
              {data.recentMovements.map((t) => (
                <tr key={t.id}>
                  <td>
                    <TransactionPill type={t.type} />
                    <div className="muted ap-small">{formatDateTime(t.createdAt)}</div>
                  </td>
                  <td>
                    {t.productName}
                    <div className="muted ap-small">
                      {t.colour} · UK {t.size.replace('K', '')}
                      {t.reference ? ` · ${t.reference}` : ''}
                    </div>
                  </td>
                  <td className="num">
                    <Change value={t.change} />
                    <div className="muted ap-small">→ {t.newQuantity}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </Panel>
      </div>
    </>
  );
}
