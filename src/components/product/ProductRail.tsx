import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Product } from '../../types';
import { ErrorState } from '../ui/Feedback';
import { ProductCard, ProductCardSkeleton } from './ProductCard';

interface Props {
  title: string;
  description?: ReactNode;
  products: Product[] | undefined;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  viewAll?: { to: string; label: string };
  count?: number;
  id?: string;
}

/** Titled product row: a horizontal scroller on mobile, a grid on desktop. */
export function ProductRail({ title, description, products, loading, error, onRetry, viewAll, count = 4, id }: Props) {
  if (!loading && !error && products && products.length === 0) return null;
  return (
    <section className="rail" aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="rail__head">
        <div>
          <h2 className="section-title" id={id ? `${id}-title` : undefined}>
            {title}
          </h2>
          {description && <p className="rail__desc muted">{description}</p>}
        </div>
        {viewAll && (
          <Link className="text-link" to={viewAll.to}>
            {viewAll.label}
          </Link>
        )}
      </div>
      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <div className="rail__track">
          {loading && !products
            ? Array.from({ length: count }, (_, i) => <ProductCardSkeleton key={i} />)
            : products?.slice(0, count).map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </section>
  );
}
