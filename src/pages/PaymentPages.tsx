import { useEffect, useState, type ReactNode } from 'react';
import { Clock, XCircle } from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { needsPayment } from '../utils/payments';
import { PayNowButton } from '../components/order/Payment';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../components/ui/Feedback';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { services } from '../services';
import type { Order } from '../types';
import { errorMessage } from '../utils/errors';

const POLL_MS = 2000;
const POLL_LIMIT_MS = 90_000;

/**
 * PayHere sends the shopper here after paying. Arriving here proves nothing: the order is only
 * paid once PayHere's server-to-server notification reaches the API, so this page waits for that.
 */
export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const orderNumber = params.get('order') ?? params.get('order_id') ?? '';
  useDocumentTitle('Confirming payment');

  const [order, setOrder] = useState<Order>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();
  const [gaveUp, setGaveUp] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!orderNumber) return;
    let cancelled = false;
    let timer: number | undefined;
    const started = Date.now();
    const check = async () => {
      try {
        const latest = await services.orders.getOrder(orderNumber);
        if (cancelled) return;
        setOrder(latest);
        setLoaded(true);
        setError(undefined);
        if (!latest || latest.paymentStatus !== 'pending') return;
      } catch (err) {
        if (cancelled) return;
        setError(errorMessage(err));
      }
      if (Date.now() - started >= POLL_LIMIT_MS) setGaveUp(true);
      else timer = window.setTimeout(check, POLL_MS);
    };
    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [orderNumber, attempt]);

  if (!orderNumber) return <Navigate to="/" replace />;
  if (order?.paymentStatus === 'paid') return <Navigate to={`/order/${order.orderNumber}`} replace state={{ justPlaced: true }} />;

  if (!loaded && !error) return <Spinner label="Confirming your payment" />;
  if (loaded && !order) {
    return (
      <div className="container page-pad">
        <EmptyState title="We couldn’t find that order" action={<ButtonLink to="/contact">Contact us</ButtonLink>}>
          If you were charged, contact our care team with the PayHere receipt and we’ll sort it out.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container page-pad payment-result">
      {order?.paymentStatus === 'failed' ? (
        <PaymentProblem order={order} title="Your payment didn’t go through">
          Nothing was charged. Your items are still held for you, so you can try again with the same or another card.
        </PaymentProblem>
      ) : order && order.paymentStatus !== 'pending' ? (
        <Navigate to={`/order/${order.orderNumber}`} replace />
      ) : gaveUp ? (
        <div className="payment-result__card" role="status">
          <Clock size={36} aria-hidden="true" />
          <h1 className="page-title">We’re still waiting for PayHere</h1>
          <p>
            PayHere hasn’t confirmed payment for order <strong>{orderNumber}</strong> yet. If you completed the payment, the confirmation can take a few minutes. Don’t pay again.
          </p>
          <div className="payment-result__actions">
            <ButtonLink to={`/order/${orderNumber}`} variant="primary">
              View order
            </ButtonLink>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setGaveUp(false);
                setAttempt((a) => a + 1);
              }}
            >
              Check again
            </button>
          </div>
        </div>
      ) : (
        <div className="payment-result__card" role="status" aria-live="polite">
          <Spinner label="Confirming your payment" />
          <h1 className="page-title">Confirming your payment…</h1>
          <p className="muted">This usually takes a few seconds. Please keep this page open.</p>
          {error && <p className="field__error">{error}</p>}
        </div>
      )}
    </div>
  );
}

/** PayHere sends the shopper here when they leave the payment page without paying. */
export function PaymentCancelPage() {
  const [params] = useSearchParams();
  const orderNumber = params.get('order') ?? params.get('order_id') ?? '';
  useDocumentTitle('Payment cancelled');
  const { data: order, loading, error, reload } = useAsync(
    () => (orderNumber ? services.orders.getOrder(orderNumber) : Promise.resolve(undefined)),
    [orderNumber],
  );

  if (!orderNumber) return <Navigate to="/" replace />;
  if (loading) return <Spinner label="Loading order" />;
  if (error) return <div className="container page-pad"><ErrorState message={error} onRetry={reload} /></div>;
  if (!order) return <Navigate to="/" replace />;
  if (order.paymentStatus === 'paid') return <Navigate to={`/order/${order.orderNumber}`} replace />;

  return (
    <div className="container page-pad payment-result">
      <PaymentProblem order={order} title="Payment cancelled">
        You left the payment page, so nothing was charged. Your items are held for a little while if you’d like to finish paying.
      </PaymentProblem>
    </div>
  );
}

function PaymentProblem({ order, title, children }: { order: Order; title: string; children: ReactNode }) {
  const payable = needsPayment(order);
  return (
    <div className="payment-result__card" role="status">
      <XCircle size={36} aria-hidden="true" />
      <h1 className="page-title">{payable ? title : 'This order can no longer be paid'}</h1>
      <p>
        {payable
          ? children
          : 'The time to pay has passed, so the order was cancelled and the items were released. Nothing was charged. Add the items to your bag again to place a new order.'}
      </p>
      <div className="payment-result__actions">
        {payable && <PayNowButton order={order} />}
        <ButtonLink to={`/order/${order.orderNumber}`} variant={payable ? 'ghost' : 'primary'}>
          View order
        </ButtonLink>
      </div>
    </div>
  );
}
