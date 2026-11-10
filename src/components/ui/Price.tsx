import { Star } from 'lucide-react';
import { discountPercent, formatPrice } from '../../utils/format';

export function Price({ price, originalPrice, size = 'md' }: { price: number; originalPrice?: number; size?: 'sm' | 'md' | 'lg' }) {
  const pct = discountPercent(price, originalPrice);
  return (
    <p className={`price price--${size}`}>
      {pct ? (
        <>
          <span className="visually-hidden">Sale price </span>
          <span className="price__current price__current--sale">{formatPrice(price)}</span>
          <span className="visually-hidden">, was </span>
          <s className="price__original">{formatPrice(originalPrice!)}</s>
          <span className="price__saving">{pct}% off</span>
        </>
      ) : (
        <span className="price__current">{formatPrice(price)}</span>
      )}
    </p>
  );
}

export function Rating({ value, count, size = 14, showValue = true }: { value: number; count?: number; size?: number; showValue?: boolean }) {
  const label = `Rated ${value.toFixed(1)} out of 5${count !== undefined ? ` from ${count} reviews` : ''}`;
  return (
    <span className="rating" role="img" aria-label={label}>
      <span className="rating__stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, value - (i - 1)));
          return (
            <span key={i} className="rating__star">
              <Star size={size} className="rating__star-bg" />
              <span className="rating__star-fill" style={{ width: `${fill * 100}%` }}>
                <Star size={size} />
              </span>
            </span>
          );
        })}
      </span>
      {showValue && (
        <span className="rating__text" aria-hidden="true">
          {value.toFixed(1)}
          {count !== undefined && <span className="muted"> ({count})</span>}
        </span>
      )}
    </span>
  );
}
