import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { genderLabels } from '../../data/labels';
import { colourInStock, defaultColourId, isProductInStock } from '../../features/catalogue/productHelpers';
import { discountPercent } from '../../utils/format';
import { Badge } from '../ui/Feedback';
import { Price, Rating } from '../ui/Price';
import { ProductImage } from '../ui/ProductImage';
import { WishlistButton } from './WishlistButton';

export function ProductCard({ product, highlightSize }: { product: Product; highlightSize?: string | null }) {
  const [colourId, setColourId] = useState(() => defaultColourId(product));
  const colour = product.colours.find((c) => c.id === colourId) ?? product.colours[0];
  const inStock = isProductInStock(product);
  const pct = discountPercent(product.price, product.originalPrice);
  const href = `/product/${product.slug}?colour=${colour.id}`;
  const sizeAvailable = highlightSize
    ? product.variants.some((v) => v.size === highlightSize && v.stock > 0)
    : undefined;

  return (
    <article className={`product-card${inStock ? '' : ' product-card--sold-out'}`}>
      <div className="product-card__media">
        <Link to={href} className="product-card__image-link" tabIndex={-1} aria-hidden="true">
          <ProductImage src={colour.images[0]} width={420} alt="" className="product-card__img product-card__img--primary" />
          <ProductImage src={colour.images[1] ?? colour.images[0]} width={420} alt="" className="product-card__img product-card__img--secondary" />
        </Link>
        <div className="product-card__badges">
          {!inStock && <Badge tone="muted">Sold out</Badge>}
          {inStock && pct && <Badge tone="sale">{pct}% off</Badge>}
          {inStock && product.isNewArrival && <Badge tone="saffron">New</Badge>}
          {inStock && !product.isNewArrival && product.isBestSeller && <Badge tone="ink">Best seller</Badge>}
        </div>
        <WishlistButton productId={product.id} productName={product.name} />
      </div>

      <div className="product-card__body">
        {product.colours.length > 1 && (
          <div className="swatches swatches--sm" role="group" aria-label={`Colours for ${product.name}`}>
            {product.colours.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`swatch${c.id === colourId ? ' is-selected' : ''}${colourInStock(product, c.id) ? '' : ' is-unavailable'}`}
                style={{ ['--swatch' as string]: c.swatch }}
                aria-label={`${c.name}${colourInStock(product, c.id) ? '' : ' (sold out)'}`}
                aria-pressed={c.id === colourId}
                onClick={() => setColourId(c.id)}
                onMouseEnter={() => setColourId(c.id)}
              />
            ))}
          </div>
        )}
        <p className="product-card__brand">{product.brand}</p>
        <h3 className="product-card__name">
          <Link to={href}>{product.name}</Link>
        </h3>
        <p className="product-card__meta">
          {genderLabels[product.gender]}
          {product.colours.length > 1 ? `, ${product.colours.length} colours` : ''}
        </p>
        <Price price={product.price} originalPrice={product.originalPrice} size="sm" />
        <Rating value={product.rating} count={product.reviewCount} size={13} />
        {highlightSize && (
          <p className={`product-card__size-note${sizeAvailable ? '' : ' is-out'}`}>
            {sizeAvailable ? `Your size (UK ${highlightSize.replace('K', '')}) is in stock` : `Sold out in UK ${highlightSize.replace('K', '')}`}
          </p>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card product-card--skeleton" aria-hidden="true">
      <span className="skeleton skeleton--media" />
      <span className="skeleton skeleton--line" />
      <span className="skeleton skeleton--line skeleton--wide" />
      <span className="skeleton skeleton--line skeleton--short" />
    </div>
  );
}
