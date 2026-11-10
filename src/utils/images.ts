/**
 * Product photography helpers.
 *
 * Mock products use free-to-use photos from Unsplash (https://unsplash.com/license), served from
 * Unsplash's image CDN so nothing heavy is bundled with the app. The CDN resizes and crops on
 * request, which gives us consistent 4:3 crops, close-up "detail" views and responsive sizes.
 *
 * When the ASP.NET Core API is connected it can return any image URL; non-Unsplash URLs are
 * passed through unchanged.
 */

const UNSPLASH = 'https://images.unsplash.com/';

export interface CropOptions {
  /** Focal point (0–1) and zoom for close-up crops. */
  fx?: number;
  fy?: number;
  zoom?: number;
}

/** Builds a 4:3 Unsplash image URL for a photo id like "1542291026-7eec264c27ff". */
export function unsplashPhoto(id: string, width = 1200, crop: CropOptions = {}): string {
  const params = new URLSearchParams({
    auto: 'format',
    fit: 'crop',
    w: String(width),
    h: String(Math.round(width * 0.75)),
    q: '75',
  });
  if (crop.zoom) {
    params.set('crop', 'focalpoint');
    params.set('fp-x', String(crop.fx ?? 0.5));
    params.set('fp-y', String(crop.fy ?? 0.5));
    params.set('fp-z', String(crop.zoom));
  }
  return `${UNSPLASH}photo-${id}?${params.toString()}`;
}

/** Gallery for one colourway: the full photo plus two close-up crops. */
export function photoGallery(id: string): string[] {
  return [
    unsplashPhoto(id),
    unsplashPhoto(id, 1200, { fx: 0.38, fy: 0.55, zoom: 1.7 }),
    unsplashPhoto(id, 1200, { fx: 0.66, fy: 0.5, zoom: 1.7 }),
  ];
}

/** Returns the URL sized for the given display width (CDN images only). */
export function sizedImage(url: string, width: number): string {
  if (!url.startsWith(UNSPLASH)) return url;
  const u = new URL(url);
  u.searchParams.set('w', String(width));
  u.searchParams.set('h', String(Math.round(width * 0.75)));
  return u.toString();
}

/** srcset with 1x and 2x candidates for crisp images on high-density screens. */
export function imageSrcSet(url: string, width: number): string | undefined {
  if (!url.startsWith(UNSPLASH)) return undefined;
  return `${sizedImage(url, width)} 1x, ${sizedImage(url, width * 2)} 2x`;
}
