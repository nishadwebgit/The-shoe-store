import { useState, type ImgHTMLAttributes } from 'react';
import { Footprints } from 'lucide-react';
import { imageSrcSet, sizedImage } from '../../utils/images';

/**
 * Image with a fixed aspect ratio and a graceful fallback, so a missing or broken URL
 * never collapses the layout. `width` is the rendered width in CSS pixels; CDN images are
 * requested at that size (plus a 2x candidate) to keep pages fast.
 */
export function ProductImage({
  src,
  alt,
  ratio = '4 / 3',
  width,
  className = '',
  ...rest
}: ImgHTMLAttributes<HTMLImageElement> & { ratio?: string; width?: number }) {
  const [failedSrc, setFailedSrc] = useState<string | undefined>();
  const failed = !src || failedSrc === src;
  const finalSrc = src && width ? sizedImage(src, width) : src;
  const srcSet = src && width ? imageSrcSet(src, width) : undefined;

  return (
    <div className={`product-image ${className}`} style={{ aspectRatio: ratio }}>
      {failed ? (
        <div className="product-image__fallback" role="img" aria-label={alt ? `${alt} (image unavailable)` : 'Image unavailable'}>
          <Footprints size={36} aria-hidden="true" />
          <span>Image coming soon</span>
        </div>
      ) : (
        <img src={finalSrc} srcSet={srcSet} alt={alt} loading="lazy" decoding="async" onError={() => setFailedSrc(src)} {...rest} />
      )}
    </div>
  );
}
