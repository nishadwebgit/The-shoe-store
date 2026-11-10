import { Heart, Lock, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FreeShippingMeter } from '../components/cart/FreeShippingMeter';
import { DiscountForm, TotalsTable } from '../components/cart/OrderSummary';
import { ProductRail } from '../components/product/ProductRail';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState, Spinner } from '../components/ui/Feedback';
import { ProductImage } from '../components/ui/ProductImage';
import { QuantityStepper } from '../components/ui/QuantityStepper';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useCart, useWishlist } from '../hooks/useStore';
import { services } from '../services';
import { formatPrice } from '../utils/format';

export function CartPage() {
  useDocumentTitle('Your bag');
  const { cart, totals, ready, updateQuantity, removeItem, pending } = useCart();
  const { has, toggle } = useWishlist();
  const productIds = cart.lines.map((l) => l.productId);
  const recs = useAsync(() => services.products.getRecommendations(productIds, 4), [productIds.join(',')]);

  if (!ready) return <Spinner label="Loading your bag" />;

  return (
    <div className="container cart-page">
      <h1 className="page-title">Your bag</h1>

      {cart.lines.length === 0 ? (
        <EmptyState icon={<ShoppingBag size={36} />} title="Your bag is empty" action={<ButtonLink to="/shop">Continue shopping</ButtonLink>}>
          Find your next pair in <Link to="/shop?collection=new">new arrivals</Link> or check your <Link to="/wishlist">wishlist</Link>.
        </EmptyState>
      ) : (
        <div className="cart-page__layout">
          <section aria-label="Items in your bag">
            <FreeShippingMeter remaining={totals.amountToFreeShipping} />
            <ul className="cart-lines">
              {cart.lines.map((line) => {
                const busy = pending.has(line.id);
                return (
                  <li key={line.id} className={`cart-line${busy ? ' is-busy' : ''}`}>
                    <Link to={`/product/${line.slug}?colour=${line.colourId}`} className="cart-line__media" tabIndex={-1} aria-hidden="true">
                      <ProductImage src={line.image} width={200} alt="" />
                    </Link>
                    <div className="cart-line__info">
                      <p className="muted cart-line__brand">{line.brand}</p>
                      <h2 className="cart-line__name">
                        <Link to={`/product/${line.slug}?colour=${line.colourId}`}>{line.name}</Link>
                      </h2>
                      <dl className="cart-line__variant">
                        <div>
                          <dt>Colour</dt>
                          <dd>{line.colourName}</dd>
                        </div>
                        <div>
                          <dt>Size</dt>
                          <dd>UK {line.size.replace('K', '')}{line.size.endsWith('K') ? ' (kids)' : ''}</dd>
                        </div>
                        <div>
                          <dt>Price</dt>
                          <dd>
                            {formatPrice(line.unitPrice)}
                            {line.originalUnitPrice && <s className="muted"> {formatPrice(line.originalUnitPrice)}</s>}
                          </dd>
                        </div>
                      </dl>
                      {line.maxQuantity <= 3 && <p className="stock-note stock-note--low">Only {line.maxQuantity} left in this size</p>}
                      <div className="cart-line__actions">
                        <button type="button" className="text-link text-link--icon" onClick={() => toggle(line.productId, line.name)}>
                          <Heart size={16} aria-hidden="true" fill={has(line.productId) ? 'currentColor' : 'none'} />
                          {has(line.productId) ? 'Saved' : 'Save for later'}
                        </button>
                        <button type="button" className="text-link text-link--icon text-link--danger" onClick={() => removeItem(line.id)} disabled={busy}>
                          <Trash2 size={16} aria-hidden="true" /> Remove
                        </button>
                      </div>
                    </div>
                    <div className="cart-line__qty">
                      <QuantityStepper value={line.quantity} max={line.maxQuantity} disabled={busy} onChange={(q) => updateQuantity(line.id, q)} label={`Quantity for ${line.name}`} />
                      <p className="cart-line__total">{formatPrice(line.unitPrice * line.quantity)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="summary-card" aria-labelledby="summary-title">
            <h2 id="summary-title" className="summary-card__title">
              Order summary
            </h2>
            <DiscountForm />
            <TotalsTable totals={totals} shippingLabel="Standard delivery" />
            <p className="muted summary-card__note">Express delivery and store collection are available at checkout.</p>
            <ButtonLink to="/checkout" variant="accent" size="lg" block icon={<Lock size={18} />}>
              Check out
            </ButtonLink>
            <ButtonLink to="/shop" variant="ghost" block>
              Continue shopping
            </ButtonLink>
          </aside>
        </div>
      )}

      <ProductRail title={cart.lines.length ? 'Goes well with your bag' : 'Popular right now'} products={recs.data} loading={recs.loading} id="cart-recs" />
    </div>
  );
}
