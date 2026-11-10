import { useState } from 'react';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ColourSelector, SizeSelector } from '../components/product/VariantSelectors';
import { Badge, EmptyState, ErrorState, Spinner } from '../components/ui/Feedback';
import { Button, ButtonLink } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Price, Rating } from '../components/ui/Price';
import { ProductImage } from '../components/ui/ProductImage';
import { defaultColourId, isProductInStock, stockFor } from '../features/catalogue/productHelpers';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useCart, usePreferences, useToast, useWishlist } from '../hooks/useStore';
import { services } from '../services';
import type { Product } from '../types';

function MoveToBagDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const { addItem, setDrawerOpen } = useCart();
  const { remove } = useWishlist();
  const { notify } = useToast();
  const { preferredSize } = usePreferences();
  const [colourId, setColourId] = useState(() => defaultColourId(product));
  const [size, setSize] = useState<string | null>(() =>
    preferredSize && stockFor(product, defaultColourId(product), preferredSize) > 0 ? preferredSize : null,
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!size) {
      setError('Select a size to move this shoe to your bag.');
      return;
    }
    setBusy(true);
    const ok = await addItem({ productId: product.id, colourId, size, quantity: 1 });
    setBusy(false);
    if (!ok) return;
    await remove(product.id);
    notify(`Moved ${product.name}, UK ${size.replace('K', '')}, to your bag`);
    onClose();
    setDrawerOpen(true);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Choose your size"
      size="md"
      footer={
        <div className="dialog__actions">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={confirm}>
            Move to bag
          </Button>
        </div>
      }
    >
      <div className="move-dialog">
        <div className="move-dialog__product">
          <ProductImage src={product.colours.find((c) => c.id === colourId)?.images[0]} width={160} alt="" />
          <div>
            <p className="muted">{product.brand}</p>
            <p className="move-dialog__name">{product.name}</p>
            <Price price={product.price} originalPrice={product.originalPrice} size="sm" />
          </div>
        </div>
        <ColourSelector
          product={product}
          value={colourId}
          onChange={(id) => {
            setColourId(id);
            if (size && stockFor(product, id, size) === 0) setSize(null);
          }}
        />
        <SizeSelector
          product={product}
          colourId={colourId}
          value={size}
          onChange={(s) => {
            setSize(s);
            setError(undefined);
          }}
          error={error}
          preferredSize={preferredSize}
        />
      </div>
    </Dialog>
  );
}

export function WishlistPage() {
  useDocumentTitle('Wishlist');
  const { ids, remove } = useWishlist();
  const { data, loading, error, reload } = useAsync(() => services.products.getProductsByIds(ids), [ids.join(',')]);
  const [moving, setMoving] = useState<Product | null>(null);
  // Only show products still in the wishlist (removal updates instantly).
  const items = (data ?? []).filter((p) => ids.includes(p.id));

  return (
    <div className="container wishlist-page">
      <div className="page-head">
        <h1 className="page-title">Wishlist</h1>
        {ids.length > 0 && <p className="muted">{ids.length} saved {ids.length === 1 ? 'shoe' : 'shoes'}. Your wishlist is saved in this browser.</p>}
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && ids.length > 0 && <Spinner label="Loading wishlist" />}

      {ids.length === 0 ? (
        <EmptyState icon={<Heart size={36} />} title="Nothing saved yet" action={<ButtonLink to="/shop">Browse shoes</ButtonLink>}>
          Tap the heart on any shoe to save it here for later.
        </EmptyState>
      ) : (
        <ul className="wishlist-grid">
          {items.map((p) => {
            const colour = p.colours.find((c) => c.id === defaultColourId(p)) ?? p.colours[0];
            const inStock = isProductInStock(p);
            return (
              <li key={p.id} className="wish-card">
                <Link to={`/product/${p.slug}`} className="wish-card__media" tabIndex={-1} aria-hidden="true">
                  <ProductImage src={colour.images[0]} width={420} alt="" />
                </Link>
                <div className="wish-card__body">
                  <p className="muted">{p.brand}</p>
                  <h2 className="wish-card__name">
                    <Link to={`/product/${p.slug}`}>{p.name}</Link>
                  </h2>
                  <Price price={p.price} originalPrice={p.originalPrice} size="sm" />
                  <Rating value={p.rating} count={p.reviewCount} size={13} />
                  {!inStock && <Badge tone="muted">Sold out</Badge>}
                </div>
                <div className="wish-card__actions">
                  <Button variant="primary" block icon={<ShoppingBag size={18} />} disabled={!inStock} onClick={() => setMoving(p)}>
                    {inStock ? 'Move to bag' : 'Sold out'}
                  </Button>
                  <Button variant="ghost" block icon={<Trash2 size={18} />} onClick={() => remove(p.id)}>
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {moving && <MoveToBagDialog product={moving} onClose={() => setMoving(null)} />}
    </div>
  );
}
