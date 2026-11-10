import { useState, type FormEvent, type ReactNode } from 'react';
import { Tag, X } from 'lucide-react';
import { useCart } from '../../hooks/useStore';
import type { CartTotals } from '../../types';
import { formatPrice } from '../../utils/format';
import { Button } from '../ui/Button';

export function DiscountForm() {
  const { cart, applyDiscount, removeDiscount, totals } = useCart();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Enter a discount code.');
      return;
    }
    setBusy(true);
    const problem = await applyDiscount(code);
    setBusy(false);
    setError(problem);
    if (!problem) setCode('');
  };

  if (cart.discountCode && totals.discountCode) {
    return (
      <div className="discount-applied">
        <Tag size={16} aria-hidden="true" />
        <span>
          <strong>{totals.discountCode.code}</strong> applied: {totals.discountCode.description}
        </span>
        <button type="button" className="icon-button icon-button--sm" aria-label={`Remove code ${totals.discountCode.code}`} onClick={() => removeDiscount()}>
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <form className="discount-form" onSubmit={submit} noValidate>
      <label htmlFor="discount-code" className="field__label">
        Discount code
      </label>
      <div className="discount-form__row">
        <input
          id="discount-code"
          className="input"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(undefined);
          }}
          autoComplete="off"
          autoCapitalize="characters"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'discount-error' : 'discount-hint'}
        />
        <Button type="submit" variant="secondary" loading={busy}>
          Apply
        </Button>
      </div>
      {error ? (
        <p className="field__error" id="discount-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="field__hint" id="discount-hint">
          Demo codes: NISHOES10, WELCOME1500, FREESHIP
        </p>
      )}
      {cart.discountCode && totals.discountError && <p className="field__error">{totals.discountError}</p>}
    </form>
  );
}

export function TotalsTable({ totals, shippingLabel = 'Delivery', children }: { totals: CartTotals; shippingLabel?: string; children?: ReactNode }) {
  return (
    <dl className="totals">
      <div className="summary-row">
        <dt>Subtotal ({totals.itemCount} {totals.itemCount === 1 ? 'item' : 'items'})</dt>
        <dd>{formatPrice(totals.subtotal)}</dd>
      </div>
      {totals.saleSavings > 0 && (
        <div className="summary-row summary-row--muted">
          <dt>Sale savings included</dt>
          <dd>{formatPrice(totals.saleSavings)}</dd>
        </div>
      )}
      {totals.discount > 0 && (
        <div className="summary-row summary-row--discount">
          <dt>Discount ({totals.discountCode?.code})</dt>
          <dd>−{formatPrice(totals.discount)}</dd>
        </div>
      )}
      <div className="summary-row">
        <dt>{shippingLabel}</dt>
        <dd>{totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping)}</dd>
      </div>
      {children}
      <div className="summary-row summary-row--total">
        <dt>Total</dt>
        <dd>{formatPrice(totals.total)}</dd>
      </div>
    </dl>
  );
}
