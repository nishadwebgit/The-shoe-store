import { appConfig } from '../config/appConfig';

const currencyFormatter = new Intl.NumberFormat(appConfig.currency.locale, {
  style: 'currency',
  currency: appConfig.currency.code,
  currencyDisplay: 'code',
  maximumFractionDigits: 0,
});

/** Formats a whole-rupee amount, e.g. 18500 → "LKR 18,500". Central place to change currency. */
export function formatPrice(amount: number): string {
  // Intl renders "LKR 18,500" with a non-breaking space; normalise for consistent display.
  return currencyFormatter.format(Math.round(amount)).replace(/ /g, ' ');
}

export function discountPercent(price: number, originalPrice?: number): number | null {
  if (!originalPrice || originalPrice <= price) return null;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const shortDateFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

const timeFormatter = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

/** e.g. "2:45 pm" */
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso));
}

export function formatDeliveryRange(from: string, to: string): string {
  return from.slice(0, 10) === to.slice(0, 10)
    ? formatShortDate(from)
    : `${formatShortDate(from)} – ${formatShortDate(to)}`;
}

export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function sizeLabel(size: string): string {
  return size.endsWith('K') ? `UK ${size.replace('K', '')} (kids)` : `UK ${size}`;
}
