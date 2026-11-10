import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, PackageCheck, RotateCcw, Store, Truck } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ProductRail } from '../components/product/ProductRail';
import { SizeGuide } from '../components/product/SizeGuide';
import { ColourSelector, SizeSelector } from '../components/product/VariantSelectors';
import { WishlistButton } from '../components/product/WishlistButton';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState, ErrorState, Spinner } from '../components/ui/Feedback';
import { Checkbox } from '../components/ui/FormField';
import { Price, Rating } from '../components/ui/Price';
import { ProductImage } from '../components/ui/ProductImage';
import { QuantityStepper } from '../components/ui/QuantityStepper';
import { appConfig, deliveryMethods } from '../config/appConfig';
import { categoryLabels, genderLabels } from '../data/labels';
import { defaultColourId, isProductInStock, stockFor, stockMessage } from '../features/catalogue/productHelpers';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useCart, usePreferences, useToast } from '../hooks/useStore';
import { services } from '../services';
import type { Product, Review } from '../types';
import { formatDate, formatDeliveryRange, formatPrice } from '../utils/format';
import { estimateDelivery } from '../utils/pricing';

const MAX_QTY = 10;

function Gallery({ product, colourId }: { product: Product; colourId: string }) {
  const colour = product.colours.find((c) => c.id === colourId) ?? product.colours[0];
  const [index, setIndex] = useState(0);
  const count = colour.images.length;
  const viewNames = ['Main view', 'Close-up', 'Second close-up'];

  return (
    <div className="gallery">
      <div className="gallery__main">
        <ProductImage src={colour.images[index]} width={900} alt={`${product.name} in ${colour.name}, ${viewNames[index]?.toLowerCase() ?? `image ${index + 1}`}`} ratio="4 / 3" />
        {count > 1 && (
          <>
            <button type="button" className="gallery__nav gallery__nav--prev" aria-label="Previous image" onClick={() => setIndex((i) => (i - 1 + count) % count)}>
              <ChevronLeft size={22} />
            </button>
            <button type="button" className="gallery__nav gallery__nav--next" aria-label="Next image" onClick={() => setIndex((i) => (i + 1) % count)}>
              <ChevronRight size={22} />
            </button>
            <p className="gallery__counter" aria-live="polite">
              {index + 1} / {count}
            </p>
          </>
        )}
      </div>
      <div className="gallery__thumbs" role="group" aria-label="Product images">
        {colour.images.map((src, i) => (
          <button key={i} type="button" className={`gallery__thumb${i === index ? ' is-active' : ''}`} aria-label={`Show ${viewNames[i] ?? `image ${i + 1}`}`} aria-current={i === index} onClick={() => setIndex(i)}>
            <ProductImage src={src} width={200} alt="" ratio="4 / 3" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewsSection({ product }: { product: Product }) {
  const { data: reviews, loading, error, reload } = useAsync(() => services.products.getReviews(product.id), [product.id]);
  const fitSummary = useMemo(() => {
    if (!reviews?.length) return null;
    const counts = { small: 0, true: 0, large: 0 } as Record<Review['fit'], number>;
    reviews.forEach((r) => (counts[r.fit] += 1));
    const total = reviews.length;
    return (['small', 'true', 'large'] as const).map((k) => ({ key: k, pct: Math.round((counts[k] / total) * 100) }));
  }, [reviews]);
  const distribution = useMemo(() => {
    // Approximate star distribution from the average for the summary chart.
    const avg = product.rating;
    const five = Math.round(Math.min(90, Math.max(30, (avg - 3.6) * 60)));
    const four = Math.round((100 - five) * 0.62);
    const three = Math.round((100 - five - four) * 0.6);
    const two = Math.round((100 - five - four - three) * 0.6);
    return [five, four, three, two, Math.max(0, 100 - five - four - three - two)];
  }, [product.rating]);

  return (
    <section className="reviews" id="reviews" aria-labelledby="reviews-title">
      <h2 className="section-title" id="reviews-title">
        Reviews
      </h2>
      <div className="reviews__layout">
        <div className="reviews__summary">
          <p className="reviews__score">{product.rating.toFixed(1)}</p>
          <Rating value={product.rating} showValue={false} size={18} />
          <p className="muted">Based on {product.reviewCount} reviews</p>
          <ul className="reviews__bars" aria-label="Rating breakdown">
            {distribution.map((pct, i) => (
              <li key={i}>
                <span>{5 - i} star</span>
                <span className="reviews__bar" aria-hidden="true">
                  <span style={{ width: `${pct}%` }} />
                </span>
                <span className="muted">{pct}%</span>
              </li>
            ))}
          </ul>
          {fitSummary && (
            <div className="fit-meter">
              <p className="fit-meter__title">How it fits</p>
              <div className="fit-meter__scale" aria-hidden="true">
                {fitSummary.map((f) => (
                  <span key={f.key} style={{ flexGrow: Math.max(f.pct, 4) }} className={`fit-meter__seg fit-meter__seg--${f.key}`} />
                ))}
              </div>
              <p className="muted fit-meter__labels">
                {fitSummary.map((f) => `${f.key === 'true' ? 'True to size' : `Runs ${f.key}`}: ${f.pct}%`).join('; ')}
              </p>
            </div>
          )}
        </div>
        <div>
          {loading && <Spinner label="Loading reviews" />}
          {error && <ErrorState message={error} onRetry={reload} />}
          <ul className="reviews__list">
            {reviews?.map((r) => (
              <li key={r.id} className="review">
                <div className="review__head">
                  <Rating value={r.rating} showValue={false} size={14} />
                  <h3 className="review__title">{r.title}</h3>
                </div>
                <p>{r.body}</p>
                <p className="review__meta muted">
                  {r.author}, {r.location}. Bought UK {r.sizePurchased.replace('K', '')}.{' '}
                  {r.fit === 'true' ? 'Fits true to size.' : `Runs ${r.fit}.`} {formatDate(r.createdAt)}
                  {r.verified && <span className="review__verified"> Verified buyer</span>}
                </p>
              </li>
            ))}
          </ul>
          <p className="muted reviews__sample-note">Sample reviews for demonstration.</p>
        </div>
      </div>
    </section>
  );
}

function ProductView({ product }: { product: Product }) {
  const [params, setParams] = useSearchParams();
  const { addItem, setDrawerOpen } = useCart();
  const { notify } = useToast();
  const { preferredSize, setPreferredSize, addRecentlyViewed, recentlyViewed } = usePreferences();
  const navigate = useNavigate();

  const requestedColour = params.get('colour');
  const colourId = product.colours.some((c) => c.id === requestedColour) ? requestedColour! : defaultColourId(product);
  const colour = product.colours.find((c) => c.id === colourId)!;

  const [chosenSize, setSize] = useState<string | null>(() =>
    preferredSize && stockFor(product, colourId, preferredSize) > 0 ? preferredSize : null,
  );
  // A chosen size that is sold out in the current colour is treated as unselected.
  const size = chosenSize && stockFor(product, colourId, chosenSize) > 0 ? chosenSize : null;
  const [chosenQuantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState<string>();
  const [guideOpen, setGuideOpen] = useState(false);
  const [busy, setBusy] = useState<'add' | 'buy' | null>(null);
  const [rememberSize, setRememberSize] = useState(false);
  const sizeRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(`${product.name} (${genderLabels[product.gender]})`);
  // Recording a view is a side effect on shared (persisted) state, so an effect is appropriate here.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => addRecentlyViewed(product.id), [product.id, addRecentlyViewed]);

  const stock = size ? stockFor(product, colourId, size) : 0;
  const maxQty = Math.max(1, Math.min(stock, MAX_QTY));
  const quantity = Math.min(chosenQuantity, maxQty);
  const inStock = isProductInStock(product);

  const selectColour = (id: string) => {
    setParams((p) => {
      const next = new URLSearchParams(p);
      next.set('colour', id);
      return next;
    }, { replace: true, preventScrollReset: true });
  };

  const submit = async (mode: 'add' | 'buy') => {
    if (!size) {
      setSizeError('Select a size to continue.');
      sizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sizeRef.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
      return;
    }
    if (stock === 0) {
      setSizeError('This size has just sold out. Choose another size.');
      return;
    }
    setBusy(mode);
    const ok = await addItem({ productId: product.id, colourId, size, quantity });
    setBusy(null);
    if (!ok) return;
    if (rememberSize) setPreferredSize(size);
    if (mode === 'buy') {
      navigate('/checkout');
    } else {
      notify(`Added ${product.name}, UK ${size.replace('K', '')}, to your bag`);
      setDrawerOpen(true);
    }
  };

  const standard = estimateDelivery('standard');
  const express = estimateDelivery('express');
  const stockInfo = size ? stockMessage(stock) : null;

  return (
    <div className="container pdp">
      <Breadcrumbs
        items={[
          { label: 'Home', to: '/' },
          { label: genderLabels[product.gender], to: product.gender === 'unisex' ? '/shop' : `/shop?gender=${product.gender}` },
          { label: categoryLabels[product.categories[0]], to: `/shop?category=${product.categories[0]}` },
          { label: product.name },
        ]}
      />

      <div className="pdp__layout">
        <Gallery key={colourId} product={product} colourId={colourId} />

        <div className="pdp__info">
          <p className="pdp__brand">
            <Link to={`/shop?brand=${encodeURIComponent(product.brand)}`}>{product.brand}</Link>
          </p>
          <h1 className="pdp__title">{product.name}</h1>
          <p className="muted">
            {{ men: 'Men’s', women: 'Women’s', kids: 'Kids’', unisex: 'Unisex' }[product.gender]} {categoryLabels[product.categories[0]].toLowerCase()} shoe
          </p>
          <a href="#reviews" className="pdp__rating">
            <Rating value={product.rating} count={product.reviewCount} />
          </a>
          <Price price={product.price} originalPrice={product.originalPrice} size="lg" />
          {product.originalPrice && (
            <p className="pdp__saving">You save {formatPrice(product.originalPrice - product.price)}</p>
          )}

          <ColourSelector product={product} value={colourId} onChange={selectColour} />

          <div ref={sizeRef}>
            <SizeSelector
              product={product}
              colourId={colourId}
              value={size}
              onChange={(s) => {
                setSize(s);
                setSizeError(undefined);
              }}
              error={sizeError}
              onOpenGuide={() => setGuideOpen(true)}
              preferredSize={preferredSize}
            />
          </div>

          {stockInfo && (
            <p className={`stock-note stock-note--${stockInfo.tone}`} role="status">
              {stockInfo.text}
            </p>
          )}

          {inStock ? (
            <>
              <div className="pdp__qty">
                <span className="selector__legend" id="qty-label">
                  Quantity
                </span>
                <QuantityStepper value={quantity} max={size ? maxQty : 1} onChange={setQuantity} disabled={!size} />
                {size && stock > 0 && stock <= MAX_QTY && <span className="muted">Max {maxQty}</span>}
              </div>

              <div className="pdp__actions">
                <Button variant="primary" size="lg" block loading={busy === 'add'} onClick={() => submit('add')}>
                  Add to bag
                </Button>
                <Button variant="accent" size="lg" block loading={busy === 'buy'} onClick={() => submit('buy')}>
                  Buy now
                </Button>
                <WishlistButton productId={product.id} productName={product.name} variant="full" />
              </div>
              {size && size !== preferredSize && (
                <Checkbox checked={rememberSize} onChange={(e) => setRememberSize(e.target.checked)} label={`Remember UK ${size.replace('K', '')} as my size`} />
              )}
            </>
          ) : (
            <div className="pdp__soldout">
              <p>
                <strong>This shoe is sold out in every size.</strong> Save it to your wishlist and we’ll keep it there for when it returns.
              </p>
              <WishlistButton productId={product.id} productName={product.name} variant="full" />
            </div>
          )}

          <ul className="pdp__promises">
            <li>
              <Truck size={20} aria-hidden="true" />
              <span>
                <strong>Standard delivery {formatDeliveryRange(standard.from, standard.to)}.</strong> Free over{' '}
                {formatPrice(appConfig.shipping.freeShippingThreshold)}, otherwise {formatPrice(deliveryMethods[0].baseFee)}.
              </span>
            </li>
            <li>
              <PackageCheck size={20} aria-hidden="true" />
              <span>
                <strong>Express by {formatDeliveryRange(express.to, express.to)}</strong> in Colombo, Gampaha and Kalutara ({formatPrice(deliveryMethods[1].baseFee)}).
              </span>
            </li>
            <li>
              <Store size={20} aria-hidden="true" />
              <span>Free collection from our Ward Place store, Colombo 07.</span>
            </li>
            <li>
              <RotateCcw size={20} aria-hidden="true" />
              <span>
                Free size exchanges and returns within 30 days. <Link to="/help/returns">Returns policy</Link>
              </span>
            </li>
          </ul>

          <div className="accordion">
            <details open>
              <summary>Description</summary>
              <div className="accordion__body">
                <p>{product.description}</p>
                <ul className="bullets">
                  {product.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
                <p className="muted">Shown in {colour.name}.</p>
              </div>
            </details>
            <details>
              <summary>Specifications</summary>
              <div className="accordion__body">
                <dl className="spec-list">
                  {product.specifications.map((s) => (
                    <div key={s.label}>
                      <dt>{s.label}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
            <details>
              <summary>Materials and care</summary>
              <div className="accordion__body">
                <p>{product.materials}</p>
                <p>{product.care}</p>
              </div>
            </details>
          </div>
        </div>
      </div>

      <ReviewsSection product={product} />

      <RelatedRails product={product} recentlyViewed={recentlyViewed} />

      <SizeGuide open={guideOpen} onClose={() => setGuideOpen(false)} system={product.sizeSystem} />
    </div>
  );
}

function RelatedRails({ product, recentlyViewed }: { product: Product; recentlyViewed: string[] }) {
  const related = useAsync(() => services.products.getRelatedProducts(product.id, 4), [product.id]);
  const recentIds = recentlyViewed.filter((id) => id !== product.id).slice(0, 4);
  const recent = useAsync(() => services.products.getProductsByIds(recentIds), [recentIds.join(',')]);
  return (
    <>
      <ProductRail title="You might also like" products={related.data} loading={related.loading} error={related.error} onRetry={related.reload} id="related" />
      {recentIds.length > 0 && <ProductRail title="Recently viewed" products={recent.data} loading={recent.loading} id="recent" />}
    </>
  );
}

export function ProductPage() {
  const { slug = '' } = useParams();
  const { data: product, loading, error, reload } = useAsync(() => services.products.getProductBySlug(slug), [slug]);

  if (loading && !product) return <Spinner label="Loading product" />;
  if (error) {
    return (
      <div className="container page-pad">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }
  if (!product) {
    return (
      <div className="container page-pad">
        <EmptyState title="We couldn’t find that shoe" action={<ButtonLink to="/shop">Browse all shoes</ButtonLink>}>
          It may have been discontinued, or the link may be wrong.
        </EmptyState>
      </div>
    );
  }
  return <ProductView key={product.id} product={product} />;
}
