import { Link } from 'react-router-dom';
import { deliveryMethods } from '../../config/appConfig';
import type { Order, OrderStatus } from '../../types';
import { formatDate, formatDeliveryRange, formatPrice } from '../../utils/format';
import { ProductImage } from '../ui/ProductImage';
import { PaymentSummary } from './Payment';

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Order placed',
  confirmed: 'Confirmed',
  processing: 'Being prepared',
  'ready-for-dispatch': 'Ready to ship',
  shipped: 'On its way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`status status--${status}`}>{statusLabels[status] ?? status}</span>;
}

/** Customer-facing progress: the store's internal steps are grouped into four stages. */
const timeline: { label: string; statuses: OrderStatus[] }[] = [
  { label: 'Order placed', statuses: ['pending'] },
  { label: 'Confirmed', statuses: ['confirmed', 'processing', 'ready-for-dispatch'] },
  { label: 'On its way', statuses: ['shipped'] },
  { label: 'Delivered', statuses: ['delivered'] },
];

export function OrderDetails({ order }: { order: Order }) {
  const method = deliveryMethods.find((m) => m.id === order.deliveryMethod);
  const reached = timeline.findIndex((t) => t.statuses.includes(order.status));
  const a = order.shippingAddress;
  return (
    <div className="order-details">
      <ol className="order-timeline" aria-label="Order progress">
        {timeline.map((t, i) => (
          <li key={t.label} className={i <= reached ? 'is-done' : ''} aria-current={i === reached ? 'step' : undefined}>
            <span className="order-timeline__dot" aria-hidden="true" />
            <span>{i === reached && t.label === 'Confirmed' && order.status !== 'confirmed' ? statusLabels[order.status] : t.label}</span>
          </li>
        ))}
      </ol>

      <div className="order-details__grid">
        <section>
          <h3 className="order-details__heading">Items</h3>
          <ul className="summary-lines">
            {order.lines.map((l) => (
              <li key={l.sku}>
                <div className="summary-lines__img">
                  <ProductImage src={l.image} width={96} alt="" />
                  <span className="summary-lines__qty" aria-label={`Quantity ${l.quantity}`}>
                    {l.quantity}
                  </span>
                </div>
                <div>
                  <p className="summary-lines__name">
                    <Link to={`/product/${l.slug}`}>{l.name}</Link>
                  </p>
                  <p className="muted">
                    {l.colourName}, UK {l.size.replace('K', '')}, {formatPrice(l.unitPrice)} each
                  </p>
                </div>
                <p>{formatPrice(l.unitPrice * l.quantity)}</p>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="order-details__heading">Delivery</h3>
          <p>
            {method?.label}
            <br />
            <span className="muted">
              {order.status === 'delivered' ? 'Delivered' : 'Estimated'} {formatDeliveryRange(order.estimatedDelivery.from, order.estimatedDelivery.to)}
            </span>
          </p>
          <address>
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
          <h3 className="order-details__heading">Payment</h3>
          <PaymentSummary order={order} />
        </section>
        <section>
          <h3 className="order-details__heading">Totals</h3>
          <dl className="totals">
            <div className="summary-row">
              <dt>Subtotal</dt>
              <dd>{formatPrice(order.subtotal)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="summary-row summary-row--discount">
                <dt>Discount ({order.discountCode})</dt>
                <dd>−{formatPrice(order.discount)}</dd>
              </div>
            )}
            <div className="summary-row">
              <dt>Delivery</dt>
              <dd>{order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}</dd>
            </div>
            <div className="summary-row summary-row--total">
              <dt>Total</dt>
              <dd>{formatPrice(order.total)}</dd>
            </div>
          </dl>
          <p className="muted">Placed {formatDate(order.placedAt)}</p>
        </section>
      </div>
    </div>
  );
}
