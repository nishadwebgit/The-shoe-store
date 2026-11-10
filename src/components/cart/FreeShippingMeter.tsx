import { Truck } from 'lucide-react';
import { appConfig } from '../../config/appConfig';
import { formatPrice } from '../../utils/format';

export function FreeShippingMeter({ remaining }: { remaining: number }) {
  const threshold = appConfig.shipping.freeShippingThreshold;
  const progress = Math.min(100, ((threshold - remaining) / threshold) * 100);
  return (
    <div className="ship-meter">
      <p className="ship-meter__text">
        <Truck size={18} aria-hidden="true" />
        {remaining > 0 ? (
          <span>
            Add <strong>{formatPrice(remaining)}</strong> more for free standard delivery
          </span>
        ) : (
          <span>
            <strong>Free standard delivery</strong> is included with this order
          </span>
        )}
      </p>
      <div className="ship-meter__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Progress to free delivery">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
