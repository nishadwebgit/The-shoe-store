import { useState } from 'react';
import { ArrowLeft, Check, Lock, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { ErrorState, Spinner } from '../../components/ui/Feedback';
import { TextAreaField } from '../../components/ui/FormField';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../hooks/useStore';
import { errorMessage } from '../../utils/errors';
import { adminApi, orderActionLabels, orderStatusLabels, paymentLabels } from '../api';
import { DataTable, OrderStatusPill, PageHeader, Panel, PaymentPill, Pill, Thumb } from '../components';
import { formatDateTime, formatDay, formatLkr } from '../format';
import type { AdminOrder, AdminOrderStatus } from '../types';

const flow: AdminOrderStatus[] = ['pending', 'confirmed', 'processing', 'ready-for-dispatch', 'shipped', 'delivered'];
const needsPayment: AdminOrderStatus[] = ['ready-for-dispatch', 'shipped', 'delivered'];

export default function OrderDetailPage() {
  const { orderNumber = '' } = useParams();
  useDocumentTitle(`${orderNumber} · Owner Portal`);
  const loaded = useAsync(() => adminApi.order(orderNumber), [orderNumber]);
  const [override, setOverride] = useState<AdminOrder>();
  const data = override && override.order.orderNumber === orderNumber ? override : loaded.data;

  if (loaded.error && !data) return <ErrorState message={loaded.error} onRetry={loaded.reload} />;
  if (!data) return <Spinner label="Loading order" />;

  const { order, customer } = data;
  const a = order.shippingAddress;
  const itemCount = order.lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <>
      <Link to="/admin/orders" className="text-link text-link--icon ap-back">
        <ArrowLeft size={16} aria-hidden="true" /> All orders
      </Link>
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={
          <>
            Placed {formatDateTime(order.placedAt)} · {itemCount} item{itemCount === 1 ? '' : 's'} · {formatLkr(order.total)}{' '}
            <OrderStatusPill status={order.status} /> <PaymentPill status={order.paymentStatus} orderStatus={order.status} />
          </>
        }
      />

      <StatusActions data={data} onChange={setOverride} />

      <div className="ap-grid ap-grid--2-1">
        <div className="ap-col">
          <Panel title={`Items (${itemCount})`}>
            <DataTable colSpan={5}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Colour / size</th>
                  <th className="num">Qty</th>
                  <th className="num">Price</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((l) => (
                  <tr key={l.sku}>
                    <td>
                      <div className="ap-product-cell">
                        <Thumb src={l.image} alt="" />
                        <div>
                          <strong>{l.name}</strong>
                          <div className="muted ap-small">
                            {l.brand} · <span className="ap-mono">{l.sku}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {l.colourName}
                      <div className="muted ap-small">UK {l.size.replace('K', '')}</div>
                    </td>
                    <td className="num">{l.quantity}</td>
                    <td className="num">{formatLkr(l.unitPrice)}</td>
                    <td className="num">{formatLkr(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <dl className="ap-totals">
              <dt>Subtotal</dt>
              <dd>{formatLkr(order.subtotal)}</dd>
              {order.discount > 0 && (
                <>
                  <dt>Discount{order.discountCode ? ` (${order.discountCode})` : ''}</dt>
                  <dd>−{formatLkr(order.discount)}</dd>
                </>
              )}
              <dt>Delivery ({order.deliveryMethodName})</dt>
              <dd>{order.shipping === 0 ? 'Free' : formatLkr(order.shipping)}</dd>
              <dt className="ap-totals__grand">Total</dt>
              <dd className="ap-totals__grand">{formatLkr(order.total)}</dd>
            </dl>
          </Panel>

          <Panel title="Order history">
            <ol className="ap-timeline">
              {[...data.history].reverse().map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <span className="ap-timeline__dot" aria-hidden="true" />
                  <div>
                    <div>
                      <OrderStatusPill status={h.status} /> <span className="muted ap-small">{formatDateTime(h.at)} · {h.by}</span>
                    </div>
                    {h.note && <p className="ap-timeline__note">{h.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="ap-col">
          <Panel title="Customer">
            <dl className="ap-dl">
              <dt>Name</dt>
              <dd>{customer.name}</dd>
              <dt>Email</dt>
              <dd>
                <a className="text-link" href={`mailto:${customer.email}`}>
                  {customer.email}
                </a>
              </dd>
              <dt>Phone</dt>
              <dd>
                <a className="text-link" href={`tel:${customer.phone}`}>
                  {customer.phone}
                </a>
              </dd>
              <dt>Account</dt>
              <dd>
                {customer.isGuest ? 'Guest checkout' : `Member since ${formatDay(customer.memberSince)}`} ·{' '}
                <Link className="text-link" to={`/admin/orders?search=${encodeURIComponent(customer.email)}`}>
                  {customer.orderCount} order{customer.orderCount === 1 ? '' : 's'}
                </Link>
              </dd>
            </dl>
          </Panel>

          <Panel title="Delivery">
            <address className="ap-address">
              {a.firstName} {a.lastName}
              <br />
              {a.line1}
              {a.line2 && (
                <>
                  <br />
                  {a.line2}
                </>
              )}
              <br />
              {a.city}, {a.district} {a.postalCode}
              <br />
              {a.phone}
            </address>
            <p className="ap-small">
              <strong>{order.deliveryMethodName}</strong>
              <br />
              <span className="muted">
                Estimated {formatDay(order.estimatedDelivery.from)} – {formatDay(order.estimatedDelivery.to)}
              </span>
            </p>
          </Panel>

          <Panel title="Payment">
            <dl className="ap-dl">
              <dt>Status</dt>
              <dd>
                <PaymentPill status={order.paymentStatus} orderStatus={order.status} />
              </dd>
              <dt>Method</dt>
              <dd>{order.paymentMethod === 'demo' ? 'Demo payment (no money taken)' : order.paymentProvider}</dd>
              {order.paymentExpiresAt && (
                <>
                  <dt>Pay by</dt>
                  <dd>{formatDateTime(order.paymentExpiresAt)} (then cancelled automatically)</dd>
                </>
              )}
            </dl>
            {data.payments.length > 0 && (
              <>
                <h3 className="ap-subtitle">Gateway notifications</h3>
                <ul className="ap-payments">
                  {data.payments.map((p, i) => (
                    <li key={i}>
                      <div>
                        <Pill tone={p.signatureValid ? (p.status === 'paid' ? 'good' : 'neutral') : 'danger'}>
                          {p.signatureValid ? paymentLabels[p.status] ?? p.status : 'Rejected: invalid signature'}
                        </Pill>{' '}
                        <span className="muted ap-small">{formatDateTime(p.at)}</span>
                      </div>
                      <div className="ap-small">
                        {p.provider} {p.paymentId ? `#${p.paymentId}` : ''} · {formatLkr(p.amount)} {p.method ? `· ${p.method}` : ''}
                        {p.message ? <div className="muted">{p.message}</div> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

function StatusActions({ data, onChange }: { data: AdminOrder; onChange: (order: AdminOrder) => void }) {
  const { notify } = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string>();
  const status = data.order.status;
  const next = data.nextStatuses.find((s) => s !== 'cancelled');
  const canCancel = data.nextStatuses.includes('cancelled');
  const blocked = next && needsPayment.includes(next) && !data.paymentSettled;
  const currentIndex = flow.indexOf(status);

  const move = async (target: AdminOrderStatus, text?: string) => {
    setBusy(true);
    try {
      const updated = await adminApi.updateOrderStatus(data.order.orderNumber, target, text);
      onChange(updated);
      setNote('');
      notify(`Order ${data.order.orderNumber} is now ${orderStatusLabels[target].toLowerCase()}.`, 'success');
      return true;
    } catch (e) {
      notify(errorMessage(e), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ap-panel ap-status-panel">
      <ol className="ap-progress" aria-label="Fulfilment progress">
        {flow.map((s, i) => (
          <li key={s} className={status === 'cancelled' ? '' : i < currentIndex || status === 'delivered' ? 'is-done' : i === currentIndex ? 'is-current' : ''}>
            <span className="ap-progress__dot">{status !== 'cancelled' && (i < currentIndex || status === 'delivered') ? <Check size={13} /> : i + 1}</span>
            <span>{orderStatusLabels[s]}</span>
          </li>
        ))}
      </ol>

      {status === 'cancelled' ? (
        <p className="ap-alert ap-alert--danger">This order was cancelled. Its items were returned to stock.</p>
      ) : status === 'delivered' ? (
        <p className="ap-alert ap-alert--good">Delivered. Nothing more to do.</p>
      ) : (
        <div className="ap-status-actions">
          {data.paymentBlockReason && (
            <p className={`ap-alert ${blocked ? 'ap-alert--warn' : 'ap-alert--info'}`}>
              {blocked && <Lock size={16} aria-hidden="true" />} {data.paymentBlockReason}
            </p>
          )}
          {next && (
            <div className="ap-status-actions__row">
              <label className="ap-note">
                <span className="visually-hidden">Note for the order history</span>
                <input
                  className="input"
                  placeholder={next === 'shipped' ? 'Optional note, e.g. courier and tracking number' : 'Optional note for the order history'}
                  value={note}
                  maxLength={250}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <Button variant="accent" loading={busy} disabled={Boolean(blocked)} onClick={() => move(next, note.trim() || undefined)}>
                {orderActionLabels[next]}
              </Button>
              {canCancel && (
                <Button variant="ghost" className="btn--danger-text" icon={<XCircle size={17} aria-hidden="true" />} disabled={busy} onClick={() => setCancelOpen(true)}>
                  Cancel order
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <Dialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Cancel order ${data.order.orderNumber}?`}
        size="sm"
        footer={
          <div className="ap-dialog-actions">
            <Button variant="ghost" onClick={() => setCancelOpen(false)} disabled={busy}>
              Keep order
            </Button>
            <Button
              variant="primary"
              className="btn--danger"
              loading={busy}
              onClick={async () => {
                if (cancelReason.trim().length < 3) return setCancelError('Give a reason. It’s kept in the order history.');
                if (await move('cancelled', cancelReason.trim())) {
                  setCancelOpen(false);
                  setCancelReason('');
                }
              }}
            >
              Cancel order
            </Button>
          </div>
        }
      >
        <p>The items go back into stock straight away. This can’t be undone.</p>
        {data.order.paymentStatus === 'paid' && (
          <p className="ap-alert ap-alert--warn">The customer has paid {formatLkr(data.order.total)}. Refund them in the PayHere portal; cancelling here doesn’t move money.</p>
        )}
        <TextAreaField label="Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} error={cancelError} rows={3} maxLength={200} />
      </Dialog>
    </section>
  );
}
