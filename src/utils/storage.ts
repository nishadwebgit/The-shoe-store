/**
 * Safe wrapper around localStorage. Storage can be unavailable (private mode, quotas, SSR),
 * so every access is guarded and falls back to the provided default.
 * All keys are namespaced and versioned so a schema change can invalidate old data.
 */
const PREFIX = 'nishoes:v1:';

export const storageKeys = {
  cart: 'cart',
  wishlist: 'wishlist',
  session: 'session',
  customers: 'customers',
  orders: 'orders',
  recentlyViewed: 'recently-viewed',
  preferredSize: 'preferred-size',
  newsletter: 'newsletter',
  inventory: 'inventory-adjustments',
  /** Anonymous server cart token (API mode). */
  cartToken: 'cart-token',
  /** Email used for guest orders, so the confirmation page can load them (API mode). */
  guestOrders: 'guest-orders',
} as const;

export type StorageKey = (typeof storageKeys)[keyof typeof storageKeys];

export function readStorage<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: StorageKey, value: T): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore quota / privacy-mode errors: the app keeps working in memory.
  }
}

export function removeStorage(key: StorageKey): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export function isOurStorageKey(fullKey: string | null, key: StorageKey): boolean {
  return fullKey === PREFIX + key;
}
