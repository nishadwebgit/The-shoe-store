import { useState } from 'react';
import { Lock } from 'lucide-react';
import { services } from '../../services';
import type { Order } from '../../types';
import { errorMessage } from '../../utils/errors';
import { formatPrice, formatTime } from '../../utils/format';
import { submitHostedCheckout } from '../../utils/hostedCheckout';
import { Button } from '../ui/Button';

/** Starts (or restarts) PayHere hosted checkout for an order awaiting payment. */
export function PayNowButton({ order, label }: { order: Order; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const pay = async () => {
    setBusy(true);
    setError(undefined);
    try {
      submitHostedCheckout(await services.payments.startPayHereCheckout(order.orderNumber));
      // The browser is now leaving for PayHere; keep the button busy.
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="pay-now">
      <Button variant="accent" size="lg" icon={<Lock size={18} aria-hidden="true" />} loading={busy} onClick={pay}>
        {label ?? `Pay ${formatPrice(order.total)} securely`}
      </Button>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** One-line description of the order's payment for order details. */
export function PaymentSummary({ order }: { order: Order }) {
  switch (order.paymentStatus) {
    case 'paid':
      return <p>Paid by card via PayHere.</p>;
    case 'pending':
      return (
        <p className="muted">
          Awaiting payment.
          {order.paymentExpiresAt && order.status !== 'cancelled' && <> Items are held until {formatTime(order.paymentExpiresAt)}.</>}
        </p>
      );
    case 'failed':
      return order.status === 'cancelled' ? (
        <p className="muted">Not paid. The order was cancelled and nothing was charged.</p>
      ) : (
        <p className="muted">The last payment attempt didn’t go through. You can try again.</p>
      );
    case 'refunded':
      return <p className="muted">Payment refunded.</p>;
    default:
      return <p className="muted">Demo payment. No money was charged.</p>;
  }
}
