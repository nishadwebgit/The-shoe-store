import { CheckCircle2 } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { OrderDetails, StatusPill } from '../components/order/OrderDetails';
import { needsPayment } from '../utils/payments';
import { PayNowButton } from '../components/order/Payment';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../components/ui/Feedback';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuth } from '../hooks/useStore';
import { services } from '../services';
import { formatPrice } from '../utils/format';

export function OrderConfirmationPage() {
  const { orderNumber = '' } = useParams();
  const location = useLocation();
  const justPlaced = Boolean((location.state as { justPlaced?: boolean } | null)?.justPlaced);
  const { customer } = useAuth();
  const { data: order, loading, error, reload } = useAsync(() => services.orders.getOrder(orderNumber), [orderNumber]);
  useDocumentTitle(justPlaced ? 'Order confirmed' : `Order ${orderNumber}`);

  if (loading) return <Spinner label="Loading order" />;
  if (error) return <div className="container page-pad"><ErrorState message={error} onRetry={reload} /></div>;
  if (!order) {
    return (
      <div className="container page-pad">
        <EmptyState title="We couldn’t find that order" action={<ButtonLink to="/contact">Contact us</ButtonLink>}>
          Check the order number in your confirmation email, or contact our care team.
        </EmptyState>
      </div>
    );
  }

  const paid = order.paymentStatus === 'paid';
  const simulated = order.paymentStatus === 'simulated' || !order.paymentStatus;
  const awaitingPayment = needsPayment(order);

  return (
    <div className="container confirmation">
      {awaitingPayment && (
        <div className="payment-banner" role="status">
          <div>
            <h2 className="payment-banner__title">{order.paymentStatus === 'failed' ? 'Payment didn’t go through' : 'Awaiting payment'}</h2>
            <p>Your items are held for you. Pay now by card to confirm order {order.orderNumber}.</p>
          </div>
          <PayNowButton order={order} />
        </div>
      )}
      {justPlaced && (paid || simulated) ? (
        <div className="confirmation__hero" role="status">
          <CheckCircle2 size={40} aria-hidden="true" />
          <div>
            <h1 className="page-title">
              {paid ? `Payment received. Thank you, ${order.shippingAddress.firstName}!` : `Thank you, ${order.shippingAddress.firstName}. Your order is in.`}
            </h1>
            <p>
              Order number <strong className="confirmation__number">{order.orderNumber}</strong>. In the live store, a confirmation would go to{' '}
              <strong>{order.email}</strong>.
            </p>
            <p className="muted">
              {paid
                ? `PayHere confirmed your payment of ${formatPrice(order.total)}.`
                : 'This was a demo order: no payment was taken and nothing will ship.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="page-head">
          <h1 className="page-title">Order {order.orderNumber}</h1>
          <StatusPill status={order.status} />
        </div>
      )}

      <OrderDetails order={order} />

      <div className="confirmation__actions">
        <ButtonLink to="/shop" variant="primary">
          Continue shopping
        </ButtonLink>
        {customer && order.customerId === customer.id ? (
          <ButtonLink to="/account/orders" variant="secondary">
            View order history
          </ButtonLink>
        ) : (
          <p className="muted">
            <Link to="/register">Create an account</Link> to track future orders in one place.
          </p>
        )}
      </div>
    </div>
  );
}
