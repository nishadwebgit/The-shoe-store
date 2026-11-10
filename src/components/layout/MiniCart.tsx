import { ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '../../hooks/useStore';
import { formatPrice } from '../../utils/format';
import { ButtonLink } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { EmptyState } from '../ui/Feedback';
import { ProductImage } from '../ui/ProductImage';
import { QuantityStepper } from '../ui/QuantityStepper';
import { FreeShippingMeter } from '../cart/FreeShippingMeter';

export function MiniCart() {
  const { cart, totals, drawerOpen, setDrawerOpen, updateQuantity, removeItem, pending } = useCart();
  const close = () => setDrawerOpen(false);

  return (
    <Dialog
      open={drawerOpen}
      onClose={close}
      title={`Your bag (${totals.itemCount})`}
      variant="drawer-right"
      footer={
        cart.lines.length > 0 && (
          <div className="mini-cart__footer">
            <div className="summary-row summary-row--total">
              <span>Subtotal</span>
              <span>{formatPrice(totals.subtotal)}</span>
            </div>
            <p className="muted mini-cart__note">Delivery and discount codes are calculated in your bag.</p>
            <ButtonLink to="/checkout" variant="accent" size="lg" block onClick={close}>
              Check out
            </ButtonLink>
            <ButtonLink to="/cart" variant="secondary" size="lg" block onClick={close}>
              View bag
            </ButtonLink>
          </div>
        )
      }
    >
      {cart.lines.length === 0 ? (
        <EmptyState icon={<ShoppingBag size={32} />} title="Your bag is empty" action={<ButtonLink to="/shop" onClick={close}>Shop all shoes</ButtonLink>}>
          Shoes you add appear here.
        </EmptyState>
      ) : (
        <>
          <FreeShippingMeter remaining={totals.amountToFreeShipping} />
          <ul className="mini-cart__list">
            {cart.lines.map((line) => (
              <li key={line.id} className="mini-cart__item">
                <Link to={`/product/${line.slug}?colour=${line.colourId}`} onClick={close} tabIndex={-1} aria-hidden="true">
                  <ProductImage src={line.image} width={120} alt="" className="mini-cart__img" />
                </Link>
                <div className="mini-cart__info">
                  <Link to={`/product/${line.slug}?colour=${line.colourId}`} onClick={close} className="mini-cart__name">
                    {line.name}
                  </Link>
                  <p className="muted mini-cart__variant">
                    {line.colourName}, UK {line.size.replace('K', '')}
                  </p>
                  <div className="mini-cart__row">
                    <QuantityStepper
                      size="sm"
                      value={line.quantity}
                      max={line.maxQuantity}
                      disabled={pending.has(line.id)}
                      onChange={(q) => updateQuantity(line.id, q)}
                      label={`Quantity for ${line.name}`}
                    />
                    <span className="mini-cart__price">{formatPrice(line.unitPrice * line.quantity)}</span>
                  </div>
                </div>
                <button type="button" className="icon-button icon-button--sm" aria-label={`Remove ${line.name} from bag`} onClick={() => removeItem(line.id)}>
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
