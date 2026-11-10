import { useState, type FormEvent } from 'react';
import { ChevronRight, LogOut, Package } from 'lucide-react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { OrderDetails, StatusPill } from '../../components/order/OrderDetails';
import { needsPayment } from '../../utils/payments';
import { PayNowButton } from '../../components/order/Payment';
import { Breadcrumbs } from '../../components/ui/Breadcrumbs';
import { Button, ButtonLink } from '../../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../../components/ui/Feedback';
import { Checkbox, SelectField, TextField } from '../../components/ui/FormField';
import { sizeOrder } from '../../data/labels';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth, usePreferences, useToast } from '../../hooks/useStore';
import { services } from '../../services';
import { errorMessage } from '../../utils/errors';
import { formatDate, formatPrice, pluralise } from '../../utils/format';
import { sizedImage } from '../../utils/images';
import { hasErrors, phone, required, validate } from '../../utils/validation';

export function RequireAuth() {
  const { customer, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Spinner label="Checking your session" />;
  if (!customer) return <Navigate to={`/sign-in?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  return <Outlet />;
}

export function AccountLayout() {
  const { customer, signOut } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  return (
    <div className="container account">
      <div className="account__head">
        <h1 className="page-title">Hello, {customer?.firstName}</h1>
        <p className="muted">Member since {customer ? formatDate(customer.createdAt) : ''}</p>
      </div>
      <div className="account__layout">
        <nav className="account__nav" aria-label="Account">
          <NavLink to="/account" end>
            Profile
          </NavLink>
          <NavLink to="/account/orders">Orders</NavLink>
          <NavLink to="/wishlist">Wishlist</NavLink>
          {customer?.role === 'admin' && <NavLink to="/admin">Owner Portal</NavLink>}
          <button
            type="button"
            onClick={async () => {
              // Leave the protected area first so the auth guard doesn't redirect to sign-in.
              navigate('/');
              await signOut();
              notify('You’ve signed out', 'info');
            }}
          >
            <LogOut size={18} aria-hidden="true" /> Sign out
          </button>
        </nav>
        <div className="account__content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

type ProfileKeys = 'firstName' | 'lastName' | 'phone';

export function ProfilePage() {
  useDocumentTitle('Your profile');
  const { customer, updateProfile } = useAuth();
  const { preferredSize, setPreferredSize } = usePreferences();
  const { notify } = useToast();
  const [form, setForm] = useState<Record<ProfileKeys, string>>({
    firstName: customer?.firstName ?? '',
    lastName: customer?.lastName ?? '',
    phone: customer?.phone ?? '',
  });
  const [size, setSize] = useState(customer?.preferredSize ?? preferredSize ?? '');
  const [optIn, setOptIn] = useState(customer?.marketingOptIn ?? false);
  const [errors, setErrors] = useState<Partial<Record<ProfileKeys, string>>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();

  if (!customer) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form, {
      firstName: [required('first name')],
      lastName: [required('last name')],
      phone: form.phone ? [phone] : [],
    });
    setErrors(found);
    if (hasErrors(found)) return;
    setBusy(true);
    try {
      await updateProfile({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), phone: form.phone.trim() || undefined, preferredSize: size || undefined, marketingOptIn: optIn });
      setPreferredSize(size || null);
      setFailure(undefined);
      notify('Profile saved');
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const a = customer.defaultAddress;
  return (
    <div className="account-section">
      <h2 className="section-title">Profile</h2>
      {failure && <ErrorState message={failure} />}
      <form onSubmit={submit} noValidate className="account-form">
        <div className="form-grid">
          <TextField label="First name" autoComplete="given-name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} error={errors.firstName} />
          <TextField label="Last name" autoComplete="family-name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} error={errors.lastName} />
          <TextField label="Email" type="email" value={customer.email} readOnly disabled hint="Contact us to change your email." />
          <TextField label="Mobile number" type="tel" optional autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
          <SelectField label="My shoe size" optional value={size} onChange={(e) => setSize(e.target.value)} hint="We preselect this size on product pages.">
            <option value="">Not set</option>
            {sizeOrder.map((s) => (
              <option key={s} value={s}>
                UK {s.replace('K', '')}
                {s.endsWith('K') ? ' (kids)' : ''}
              </option>
            ))}
          </SelectField>
        </div>
        <Checkbox checked={optIn} onChange={(e) => setOptIn(e.target.checked)} label="Email me about new drops and restocks" />
        <Button type="submit" loading={busy}>
          Save changes
        </Button>
      </form>

      <h2 className="section-title account-section__sub">Saved address</h2>
      {a ? (
        <address className="address-card">
          {a.firstName} {a.lastName}
          <br />
          {a.line1}
          {a.line2 ? `, ${a.line2}` : ''}
          <br />
          {a.city}, {a.district} {a.postalCode}
          <br />
          {a.phone}
        </address>
      ) : (
        <p className="muted">No saved address yet. Addresses you use at checkout can be saved here.</p>
      )}
    </div>
  );
}

export function OrdersPage() {
  useDocumentTitle('Your orders');
  const { customer } = useAuth();
  const { data: orders, loading, error, reload } = useAsync(() => services.orders.getOrdersForCustomer(customer!.id), [customer?.id]);

  return (
    <div className="account-section">
      <h2 className="section-title">Orders</h2>
      {loading && !orders && <Spinner label="Loading orders" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {orders && orders.length === 0 && (
        <EmptyState icon={<Package size={32} />} title="No orders yet" action={<ButtonLink to="/shop">Start shopping</ButtonLink>}>
          Orders you place while signed in appear here.
        </EmptyState>
      )}
      <ul className="order-list">
        {orders?.map((o) => (
          <li key={o.id}>
            <Link to={`/account/orders/${o.orderNumber}`} className="order-row">
              <div className="order-row__imgs" aria-hidden="true">
                {o.lines.slice(0, 3).map((l) => (
                  <img key={l.sku} src={sizedImage(l.image, 128)} alt="" />
                ))}
              </div>
              <div className="order-row__info">
                <p className="order-row__number">{o.orderNumber}</p>
                <p className="muted">
                  {formatDate(o.placedAt)}, {pluralise(o.lines.reduce((s, l) => s + l.quantity, 0), 'item')}
                </p>
              </div>
              <StatusPill status={o.status} />
              <p className="order-row__total">{formatPrice(o.total)}</p>
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AccountOrderPage() {
  const { orderNumber = '' } = useParams();
  const { customer } = useAuth();
  useDocumentTitle(`Order ${orderNumber}`);
  const { data: order, loading, error, reload } = useAsync(() => services.orders.getOrder(orderNumber), [orderNumber]);

  if (loading) return <Spinner label="Loading order" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!order || order.customerId !== customer?.id) {
    return (
      <EmptyState title="Order not found" action={<ButtonLink to="/account/orders">Back to orders</ButtonLink>}>
        This order isn’t linked to your account.
      </EmptyState>
    );
  }
  return (
    <div className="account-section">
      <Breadcrumbs items={[{ label: 'Orders', to: '/account/orders' }, { label: order.orderNumber }]} />
      <div className="page-head">
        <h2 className="section-title">Order {order.orderNumber}</h2>
        <StatusPill status={order.status} />
      </div>
      {needsPayment(order) && (
        <div className="payment-banner" role="status">
          <div>
            <h3 className="payment-banner__title">{order.paymentStatus === 'failed' ? 'Payment didn’t go through' : 'Awaiting payment'}</h3>
            <p>Your items are held for you. Pay now to confirm this order.</p>
          </div>
          <PayNowButton order={order} />
        </div>
      )}
      <OrderDetails order={order} />
    </div>
  );
}
