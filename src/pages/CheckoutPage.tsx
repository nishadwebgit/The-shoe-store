import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CreditCard, Lock, ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DiscountForm, TotalsTable } from '../components/cart/OrderSummary';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../components/ui/Feedback';
import { Checkbox, SelectField, TextField } from '../components/ui/FormField';
import { ProductImage } from '../components/ui/ProductImage';
import { deliveryMethods } from '../config/appConfig';
import { districts } from '../data/districts';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAuth, useCart } from '../hooks/useStore';
import { services } from '../services';
import type { Address, Customer, DeliveryMethodId, PaymentMethodChoice, ShippingOption } from '../types';
import { errorMessage } from '../utils/errors';
import { formatDeliveryRange, formatPrice } from '../utils/format';
import { submitHostedCheckout } from '../utils/hostedCheckout';
import { estimateDelivery } from '../utils/pricing';
import { email, hasErrors, phone, postalCode, required, validate } from '../utils/validation';

type Step = 'details' | 'delivery' | 'review';
const steps: { id: Step; label: string }[] = [
  { id: 'details', label: 'Your details' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'review', label: 'Review and pay' },
];

type DetailsForm = Record<'email' | 'firstName' | 'lastName' | 'phone' | 'line1' | 'line2' | 'city' | 'district' | 'postalCode', string>;

const emptyForm: DetailsForm = { email: '', firstName: '', lastName: '', phone: '', line1: '', line2: '', city: '', district: '', postalCode: '' };

const fieldLabels: Record<keyof DetailsForm, string> = {
  email: 'Email', firstName: 'First name', lastName: 'Last name', phone: 'Mobile number', line1: 'Address line 1',
  line2: 'Address line 2', city: 'Town or city', district: 'District', postalCode: 'Postal code',
};

const schema = {
  email: [email],
  firstName: [required('first name')],
  lastName: [required('last name')],
  phone: [phone],
  line1: [required('street address')],
  city: [required('town or city')],
  district: [(v: string) => (v ? undefined : 'Select your district.')],
  postalCode: [postalCode],
};

function initialForm(customer: Customer | null): DetailsForm {
  if (!customer) return emptyForm;
  const a = customer.defaultAddress;
  return {
    email: customer.email,
    firstName: a?.firstName ?? customer.firstName,
    lastName: a?.lastName ?? customer.lastName,
    phone: a?.phone ?? customer.phone ?? '',
    line1: a?.line1 ?? '',
    line2: a?.line2 ?? '',
    city: a?.city ?? '',
    district: a?.district ?? '',
    postalCode: a?.postalCode ?? '',
  };
}

export function CheckoutPage() {
  useDocumentTitle('Checkout');
  const { ready: cartReady } = useCart();
  const { ready: authReady } = useAuth();
  if (!cartReady || !authReady) return <Spinner label="Loading checkout" />;
  return <CheckoutFlow />;
}

function CheckoutFlow() {
  const { cart, totals: bagTotals, totalsFor, reload: reloadCart } = useCart();
  const { customer, refresh: refreshCustomer } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('details');
  // Signed-in customers start with their saved details.
  const [form, setForm] = useState<DetailsForm>(() => initialForm(customer));
  const [errors, setErrors] = useState<Partial<Record<keyof DetailsForm, string>>>({});
  const [chosenMethod, setMethod] = useState<DeliveryMethodId>('standard');
  const [saveAddress, setSaveAddress] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string>();
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState<string>();
  const [chosenPayment, setPayment] = useState<PaymentMethodChoice>();

  // Which payment methods the API accepts (card via PayHere; demo payments only in development).
  const paymentOptions = useAsync(() => services.payments.getOptions(), []);
  const cardEnabled = paymentOptions.data?.cardPaymentsEnabled ?? false;
  const simulatedEnabled = paymentOptions.data?.simulatedPaymentsEnabled ?? false;
  const paymentMethod: PaymentMethodChoice | undefined =
    chosenPayment === 'payhere' && cardEnabled ? 'payhere'
      : chosenPayment === 'simulated' && simulatedEnabled ? 'simulated'
        : cardEnabled ? 'payhere'
          : simulatedEnabled ? 'simulated'
            : undefined;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  // Delivery options (fees, availability by district, estimated dates) come from the server.
  const subtotalAfterDiscount = bagTotals.subtotal - bagTotals.discount;
  const shipping = useAsync(
    () => services.checkout.getShippingOptions({ district: form.district || undefined, subtotal: subtotalAfterDiscount, couponCode: cart.discountCode }),
    [form.district, subtotalAfterDiscount, cart.discountCode],
  );
  const options: ShippingOption[] =
    shipping.data ??
    deliveryMethods.map((m) => ({ id: m.id, label: m.label, description: m.description, fee: m.baseFee, available: true, estimatedDelivery: estimateDelivery(m.id) }));
  const isAvailable = (id: DeliveryMethodId) => options.find((o) => o.id === id)?.available ?? false;
  // Express is only offered in some districts; fall back to standard if the address changes.
  const method: DeliveryMethodId = isAvailable(chosenMethod) ? chosenMethod : 'standard';
  const selected = options.find((o) => o.id === method);

  // Authoritative totals for the chosen delivery method, priced by the server from its own cart.
  const quote = useAsync(
    () => services.checkout.quote({ deliveryMethod: method, district: form.district || undefined, couponCode: cart.discountCode }),
    [method, form.district, cart.updatedAt, cart.discountCode],
  );
  // While a new quote loads, show a local preview for the selected method rather than the previous quote.
  const totals = !quote.loading && quote.data ? quote.data : totalsFor(method);

  if (cart.lines.length === 0 && !placing) {
    return (
      <div className="container page-pad">
        <EmptyState icon={<ShoppingBag size={36} />} title="Your bag is empty" action={<ButtonLink to="/shop">Continue shopping</ButtonLink>}>
          Add a pair to your bag to check out.
        </EmptyState>
      </div>
    );
  }

  const set = (key: keyof DetailsForm) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submitDetails = (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form, schema);
    setErrors(found);
    if (hasErrors(found)) {
      window.setTimeout(() => document.getElementById('error-summary')?.focus(), 0);
      return;
    }
    setStep('delivery');
  };

  const address: Address = {
    firstName: form.firstName.trim(), lastName: form.lastName.trim(), line1: form.line1.trim(),
    line2: form.line2.trim() || undefined, city: form.city.trim(), district: form.district,
    postalCode: form.postalCode.trim(), phone: form.phone.trim(),
  };

  const placeOrder = async () => {
    if (!acceptTerms) {
      setTermsError('Confirm that you accept the terms to place your order.');
      return;
    }
    if (!paymentMethod) {
      setPlaceError('Payments aren’t available right now. Please try again later.');
      return;
    }
    setPlacing(true);
    setPlaceError(undefined);
    let orderNumber: string | undefined;
    try {
      const order = await services.orders.createOrder({
        email: form.email,
        customerId: customer?.id,
        shippingAddress: address,
        deliveryMethod: method,
        lines: cart.lines,
        discountCode: cart.discountCode,
        saveAddress: Boolean(customer && saveAddress),
        paymentMethod,
      });
      orderNumber = order.orderNumber;
      // The order service empties the purchased bag; refresh local state to match.
      reloadCart();
      if (customer && saveAddress) await refreshCustomer().catch(() => null);
      if (paymentMethod === 'payhere') {
        // Items are now reserved; hand over to PayHere's hosted page to take the card payment.
        submitHostedCheckout(await services.payments.startPayHereCheckout(order.orderNumber));
        return;
      }
      navigate(`/order/${order.orderNumber}`, { replace: true, state: { justPlaced: true } });
    } catch (err) {
      if (orderNumber) {
        // The order exists but the payment page couldn't open: the order page offers "Pay now".
        navigate(`/order/${orderNumber}`, { replace: true });
        return;
      }
      setPlaceError(errorMessage(err));
      setPlacing(false);
    }
  };

  const stepIndex = steps.findIndex((s) => s.id === step);
  const errorEntries = Object.entries(errors).filter(([, v]) => v) as [keyof DetailsForm, string][];

  return (
    <div className="container checkout">
      <div className="checkout__head">
        <h1 className="page-title" ref={headingRef} tabIndex={-1}>
          Checkout
        </h1>
        <p className="muted checkout__secure">
          <Lock size={16} aria-hidden="true" />{' '}
          {cardEnabled ? 'Secure checkout. Card payments are handled by PayHere.' : 'Demo checkout. No payment is taken.'}
        </p>
      </div>

      <ol className="stepper-nav" aria-label="Checkout progress">
        {steps.map((s, i) => (
          <li key={s.id} className={i === stepIndex ? 'is-current' : i < stepIndex ? 'is-done' : ''} aria-current={i === stepIndex ? 'step' : undefined}>
            {i < stepIndex ? (
              <button type="button" onClick={() => setStep(s.id)}>
                <span className="stepper-nav__num">{i + 1}</span> {s.label}
                <span className="visually-hidden"> (completed, edit)</span>
              </button>
            ) : (
              <span>
                <span className="stepper-nav__num">{i + 1}</span> {s.label}
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="checkout__layout">
        <div className="checkout__main">
          {step === 'details' && (
            <form onSubmit={submitDetails} noValidate className="checkout-panel">
              {errorEntries.length > 0 && (
                <div className="error-summary" id="error-summary" tabIndex={-1} role="alert">
                  <h2>Check these {errorEntries.length === 1 ? 'detail' : `${errorEntries.length} details`} before continuing</h2>
                  <ul>
                    {errorEntries.map(([key, msg]) => (
                      <li key={key}>
                        <a href={`#co-${key}`}>
                          {fieldLabels[key]}: {msg}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <section>
                <div className="checkout-panel__head">
                  <h2 className="checkout-panel__title">Contact</h2>
                  {!customer && (
                    <p className="muted">
                      Checking out as a guest. <Link to="/sign-in?redirect=/checkout">Sign in</Link> to use saved details.
                    </p>
                  )}
                </div>
                <div className="form-grid">
                  <TextField id="co-email" label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)} error={errors.email} hint="We’ll send your order confirmation here." />
                  <TextField id="co-phone" label="Mobile number" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone')(e.target.value)} error={errors.phone} hint="For the courier, e.g. 077 123 4567." />
                </div>
              </section>

              <section>
                <h2 className="checkout-panel__title">Delivery address</h2>
                <div className="form-grid">
                  <TextField id="co-firstName" label="First name" autoComplete="given-name" value={form.firstName} onChange={(e) => set('firstName')(e.target.value)} error={errors.firstName} />
                  <TextField id="co-lastName" label="Last name" autoComplete="family-name" value={form.lastName} onChange={(e) => set('lastName')(e.target.value)} error={errors.lastName} />
                  <div className="form-grid__full">
                    <TextField id="co-line1" label="Address line 1" autoComplete="address-line1" value={form.line1} onChange={(e) => set('line1')(e.target.value)} error={errors.line1} hint="House number and street" />
                  </div>
                  <div className="form-grid__full">
                    <TextField id="co-line2" label="Address line 2" optional autoComplete="address-line2" value={form.line2} onChange={(e) => set('line2')(e.target.value)} />
                  </div>
                  <TextField id="co-city" label="Town or city" autoComplete="address-level2" value={form.city} onChange={(e) => set('city')(e.target.value)} error={errors.city} />
                  <SelectField id="co-district" label="District" value={form.district} onChange={(e) => set('district')(e.target.value)} error={errors.district}>
                    <option value="">Select district</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </SelectField>
                  <TextField id="co-postalCode" label="Postal code" inputMode="numeric" autoComplete="postal-code" value={form.postalCode} onChange={(e) => set('postalCode')(e.target.value)} error={errors.postalCode} />
                </div>
                {customer && <Checkbox checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} label="Save this address to my account" />}
              </section>

              <Button type="submit" variant="primary" size="lg">
                Continue to delivery
              </Button>
            </form>
          )}

          {step === 'delivery' && (
            <form
              className="checkout-panel"
              onSubmit={(e) => {
                e.preventDefault();
                setStep('review');
              }}
            >
              <fieldset className="delivery-options">
                <legend className="checkout-panel__title">Choose delivery</legend>
                {shipping.error && <ErrorState message={shipping.error} onRetry={shipping.reload} />}
                {options.map((m) => {
                  const disabled = !m.available;
                  const est = m.estimatedDelivery;
                  const fee = m.fee;
                  return (
                    <label key={m.id} className={`delivery-option${method === m.id ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}>
                      <input type="radio" name="delivery" value={m.id} checked={method === m.id} disabled={disabled} onChange={() => setMethod(m.id)} />
                      <span className="delivery-option__main">
                        <span className="delivery-option__title">
                          {m.id === 'pickup' ? `Ready ${formatDeliveryRange(est.from, est.to)}` : `Arrives ${formatDeliveryRange(est.from, est.to)}`}
                        </span>
                        <span className="muted">
                          {m.label}: {disabled ? `not available in ${form.district}` : m.description}
                        </span>
                      </span>
                      <span className="delivery-option__price">{fee === 0 ? 'Free' : formatPrice(fee)}</span>
                    </label>
                  );
                })}
              </fieldset>
              <div className="checkout-panel__address">
                <p className="muted">Delivering to</p>
                <p>
                  {address.firstName} {address.lastName}, {address.line1}
                  {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.district} {address.postalCode}
                </p>
                <button type="button" className="text-link" onClick={() => setStep('details')}>
                  Change address
                </button>
              </div>
              <div className="checkout-panel__nav">
                <Button variant="ghost" onClick={() => setStep('details')}>
                  Back
                </Button>
                <Button type="submit" variant="primary" size="lg">
                  Continue to review
                </Button>
              </div>
            </form>
          )}

          {step === 'review' && (
            <div className="checkout-panel">
              <section className="review-block">
                <div className="review-block__head">
                  <h2 className="checkout-panel__title">Contact and address</h2>
                  <button type="button" className="text-link" onClick={() => setStep('details')}>
                    Edit
                  </button>
                </div>
                <p>
                  {form.email}, {form.phone}
                </p>
                <p>
                  {address.firstName} {address.lastName}, {address.line1}
                  {address.line2 ? `, ${address.line2}` : ''}, {address.city}, {address.district} {address.postalCode}
                </p>
              </section>
              <section className="review-block">
                <div className="review-block__head">
                  <h2 className="checkout-panel__title">Delivery</h2>
                  <button type="button" className="text-link" onClick={() => setStep('delivery')}>
                    Edit
                  </button>
                </div>
                <p>
                  {selected?.label}, estimated{' '}
                  {selected && formatDeliveryRange(selected.estimatedDelivery.from, selected.estimatedDelivery.to)}
                </p>
              </section>
              <section className="review-block" aria-labelledby="payment-title">
                <h2 className="checkout-panel__title" id="payment-title">
                  <CreditCard size={20} aria-hidden="true" /> Payment
                </h2>
                {paymentOptions.loading ? (
                  <p className="muted">Loading payment options…</p>
                ) : !paymentMethod ? (
                  <p className="field__error">{paymentOptions.error ?? 'Payments aren’t available right now. Please try again later.'}</p>
                ) : (
                  <fieldset className="payment-methods">
                    <legend className="visually-hidden">Payment method</legend>
                    {cardEnabled && (
                      <label className={`payment-method${paymentMethod === 'payhere' ? ' is-selected' : ''}`}>
                        <input type="radio" name="payment" value="payhere" checked={paymentMethod === 'payhere'} onChange={() => setPayment('payhere')} />
                        <span>
                          <strong>Card or wallet via PayHere</strong>
                          <span className="muted">
                            Visa, Mastercard, Amex, eZ Cash, mCash and more. You’ll enter your details on PayHere’s secure page; Nishoes never sees your card number.
                          </span>
                          {paymentOptions.data?.sandbox && (
                            <span className="payment-method__note">Sandbox mode: use a PayHere test card. No real money moves.</span>
                          )}
                        </span>
                      </label>
                    )}
                    {simulatedEnabled && (
                      <label className={`payment-method${paymentMethod === 'simulated' ? ' is-selected' : ''}`}>
                        <input type="radio" name="payment" value="simulated" checked={paymentMethod === 'simulated'} onChange={() => setPayment('simulated')} />
                        <span>
                          <strong>Demo payment</strong>
                          <span className="muted">Development only. Places the order without taking any payment.</span>
                        </span>
                      </label>
                    )}
                  </fieldset>
                )}
              </section>
              <Checkbox
                checked={acceptTerms}
                onChange={(e) => {
                  setAcceptTerms(e.target.checked);
                  setTermsError(undefined);
                }}
                aria-describedby={termsError ? 'terms-error' : undefined}
                label={
                  <>
                    I accept the{' '}
                    <Link to="/legal/terms" target="_blank">
                      terms and conditions
                    </Link>{' '}
                    and{' '}
                    <Link to="/help/returns" target="_blank">
                      returns policy
                    </Link>
                  </>
                }
              />
              {termsError && (
                <p className="field__error" id="terms-error" role="alert">
                  {termsError}
                </p>
              )}
              {placeError && <ErrorState message={placeError} />}
              <div className="checkout-panel__nav">
                <Button variant="ghost" onClick={() => setStep('delivery')} disabled={placing}>
                  Back
                </Button>
                <Button
                  variant="accent"
                  size="lg"
                  loading={placing}
                  disabled={!paymentMethod}
                  icon={paymentMethod === 'payhere' ? <Lock size={18} aria-hidden="true" /> : undefined}
                  onClick={placeOrder}
                >
                  {paymentMethod === 'payhere' ? `Continue to secure payment, ${formatPrice(totals.total)}` : `Place demo order, ${formatPrice(totals.total)}`}
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className="summary-card checkout__summary" aria-labelledby="co-summary-title" ref={summaryRef}>
          <h2 id="co-summary-title" className="summary-card__title">
            Order summary
          </h2>
          <ul className="summary-lines">
            {cart.lines.map((l) => (
              <li key={l.id}>
                <div className="summary-lines__img">
                  <ProductImage src={l.image} width={96} alt="" />
                  <span className="summary-lines__qty" aria-label={`Quantity ${l.quantity}`}>
                    {l.quantity}
                  </span>
                </div>
                <div>
                  <p className="summary-lines__name">{l.name}</p>
                  <p className="muted">
                    {l.colourName}, UK {l.size.replace('K', '')}
                  </p>
                </div>
                <p>{formatPrice(l.unitPrice * l.quantity)}</p>
              </li>
            ))}
          </ul>
          <DiscountForm />
          <TotalsTable totals={totals} shippingLabel={selected?.label ?? 'Delivery'} />
          {quote.error && <p className="field__error">{quote.error}</p>}
          <Link to="/cart" className="text-link">
            Edit bag
          </Link>
        </aside>
      </div>
    </div>
  );
}
