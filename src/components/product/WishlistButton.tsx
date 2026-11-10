import { Heart } from 'lucide-react';
import { useWishlist } from '../../hooks/useStore';

export function WishlistButton({
  productId,
  productName,
  variant = 'icon',
}: {
  productId: string;
  productName: string;
  variant?: 'icon' | 'full';
}) {
  const { has, toggle } = useWishlist();
  const saved = has(productId);
  const label = saved ? `Remove ${productName} from wishlist` : `Save ${productName} to wishlist`;

  if (variant === 'full') {
    return (
      <button type="button" className={`btn btn--secondary btn--lg wishlist-full${saved ? ' is-saved' : ''}`} aria-pressed={saved} onClick={() => toggle(productId, productName)}>
        <Heart size={20} aria-hidden="true" />
        <span>{saved ? 'Saved' : 'Save'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`wishlist-toggle${saved ? ' is-saved' : ''}`}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? 'Saved to wishlist' : 'Save to wishlist'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle(productId, productName);
      }}
    >
      <Heart size={20} aria-hidden="true" />
    </button>
  );
}
