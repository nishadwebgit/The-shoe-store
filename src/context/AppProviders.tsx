import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { services } from '../services';
import type { Cart, Customer, DeliveryMethodId } from '../types';
import { errorMessage } from '../utils/errors';
import { calculateTotals } from '../utils/pricing';
import { isOurStorageKey, readStorage, storageKeys, writeStorage } from '../utils/storage';
import {
  AuthContext,
  CartContext,
  PreferencesContext,
  ToastContext,
  WishlistContext,
  type AuthContextValue,
  type CartContextValue,
  type PreferencesContextValue,
  type Toast,
  type ToastTone,
  type WishlistContextValue,
} from './contexts';

// ---------------------------------------------------------------- Toasts

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const notify = useCallback(
    (message: string, tone: ToastTone = 'success', action?: Toast['action']) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, message, tone, action }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);
  const icons = { success: CheckCircle2, error: XCircle, info: Info };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div key={t.id} className={`toast toast--${t.tone}`}>
              <Icon size={18} aria-hidden="true" />
              <span className="toast__message">{t.message}</span>
              {t.action && (
                <Link className="toast__action" to={t.action.to} onClick={() => dismiss(t.id)}>
                  {t.action.label}
                </Link>
              )}
              <button type="button" className="icon-button icon-button--sm" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------- Cart

const emptyCart: Cart = { lines: [], updatedAt: '' };

function CartProvider({ children, notify }: { children: ReactNode; notify: (m: string, t?: ToastTone) => void }) {
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);

  const auth = useContext(AuthContext);
  const customerId = auth?.ready ? (auth.customer?.id ?? 'guest') : null;

  const refresh = useCallback(() => {
    services.cart
      .getCart()
      .then(setCart)
      .catch((e: unknown) => notify(errorMessage(e), 'error'))
      .finally(() => setReady(true));
  }, [notify]);

  // Load once the session is known, and again whenever the shopper signs in or out
  // (signing in merges the guest bag into the customer's bag on the server).
  useEffect(() => {
    if (customerId !== null) refresh();
  }, [customerId, refresh]);

  useEffect(() => {
    // Keep multiple tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (isOurStorageKey(e.key, storageKeys.cart)) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const withPending = useCallback(async (id: string, work: () => Promise<void>) => {
    setPending((p) => new Set(p).add(id));
    try {
      await work();
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const value = useMemo<CartContextValue>(() => {
    // Local preview; checkout asks the server for an authoritative quote.
    const totalsFor = (method: DeliveryMethodId) => calculateTotals(cart.lines, cart.discountCode, method);
    return {
      cart,
      ready,
      pending,
      // API mode: totals calculated by the server. Mock mode: calculated locally with the same rules.
      totals: cart.totals ?? totalsFor('standard'),
      totalsFor,
      drawerOpen,
      setDrawerOpen,
      addItem: async (input) => {
        try {
          setCart(await services.cart.addItem(input));
          return true;
        } catch (e) {
          notify(errorMessage(e), 'error');
          return false;
        }
      },
      updateQuantity: (lineId, quantity) =>
        withPending(lineId, async () => {
          try {
            setCart(await services.cart.updateQuantity(lineId, quantity));
          } catch (e) {
            notify(errorMessage(e), 'error');
          }
        }),
      removeItem: (lineId) =>
        withPending(lineId, async () => {
          try {
            setCart(await services.cart.removeItem(lineId));
          } catch (e) {
            notify(errorMessage(e), 'error');
          }
        }),
      applyDiscount: async (code) => {
        try {
          setCart(await services.cart.applyDiscount(code));
          return undefined;
        } catch (e) {
          return errorMessage(e);
        }
      },
      removeDiscount: async () => {
        try {
          setCart(await services.cart.removeDiscount());
        } catch (e) {
          notify(errorMessage(e), 'error');
        }
      },
      clear: async () => setCart(await services.cart.clear()),
      reload: refresh,
    };
  }, [cart, ready, pending, drawerOpen, notify, withPending, refresh]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ---------------------------------------------------------------- Wishlist

function WishlistProvider({ children, notify }: { children: ReactNode; notify: ToastContextNotify }) {
  const [ids, setIds] = useState<string[]>([]);
  const auth = useContext(AuthContext);
  const customerId = auth?.ready ? (auth.customer?.id ?? 'guest') : null;

  // Guests keep a local wishlist; signed-in customers use their saved one (merged on sign-in).
  useEffect(() => {
    if (customerId === null) return;
    services.wishlist
      .getProductIds()
      .then(setIds)
      .catch((e: unknown) => notify(errorMessage(e), 'error'));
  }, [customerId, notify]);

  useEffect(() => {
    const load = () => {
      services.wishlist.getProductIds().then(setIds).catch(() => undefined);
    };
    const onStorage = (e: StorageEvent) => {
      if (isOurStorageKey(e.key, storageKeys.wishlist)) load();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<WishlistContextValue>(
    () => ({
      ids,
      has: (id) => ids.includes(id),
      toggle: async (id, name) => {
        try {
          if (ids.includes(id)) {
            setIds(await services.wishlist.remove(id));
            notify(name ? `Removed ${name} from your wishlist` : 'Removed from your wishlist', 'info');
          } else {
            setIds(await services.wishlist.add(id));
            notify(name ? `Saved ${name} to your wishlist` : 'Saved to your wishlist', 'success', { label: 'View wishlist', to: '/wishlist' });
          }
        } catch (e) {
          notify(errorMessage(e), 'error');
        }
      },
      remove: async (id) => {
        try {
          setIds(await services.wishlist.remove(id));
        } catch (e) {
          notify(errorMessage(e), 'error');
        }
      },
    }),
    [ids, notify],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

type ToastContextNotify = (m: string, t?: ToastTone, a?: Toast['action']) => void;

// ---------------------------------------------------------------- Auth

function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    services.auth
      .getCurrentCustomer()
      .then(setCustomer)
      .catch(() => setCustomer(null))
      .finally(() => setReady(true));
    // API mode: if the session ends elsewhere (refresh token expired or revoked), sign out locally.
    return services.auth.onSessionChange?.((signedIn) => {
      if (!signedIn) setCustomer(null);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      customer,
      ready,
      signIn: async (request) => {
        const { customer: c } = await services.auth.signIn(request);
        setCustomer(c);
        return c;
      },
      register: async (request) => {
        const { customer: c } = await services.auth.register(request);
        setCustomer(c);
        return c;
      },
      signOut: async () => {
        await services.auth.signOut();
        setCustomer(null);
      },
      updateProfile: async (changes) => {
        const c = await services.auth.updateProfile(changes);
        setCustomer(c);
        return c;
      },
      refresh: async () => {
        const c = await services.auth.getCurrentCustomer();
        setCustomer(c);
        return c;
      },
    }),
    [customer, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------- Preferences

const RECENT_LIMIT = 8;

function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferredSize, setPreferredSizeState] = useState<string | null>(() => readStorage(storageKeys.preferredSize, null));
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>(() => readStorage(storageKeys.recentlyViewed, []));

  const value = useMemo<PreferencesContextValue>(
    () => ({
      preferredSize,
      setPreferredSize: (size) => {
        setPreferredSizeState(size);
        writeStorage(storageKeys.preferredSize, size);
      },
      recentlyViewed,
      addRecentlyViewed: (id) =>
        setRecentlyViewed((list) => {
          if (list[0] === id) return list;
          const next = [id, ...list.filter((x) => x !== id)].slice(0, RECENT_LIMIT);
          writeStorage(storageKeys.recentlyViewed, next);
          return next;
        }),
    }),
    [preferredSize, recentlyViewed],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

// ---------------------------------------------------------------- Composition

function StoreProviders({ children }: { children: ReactNode }) {
  return (
    <ToastContext.Consumer>
      {(toast) => (
        <AuthProvider>
          <PreferencesProvider>
            <CartProvider notify={toast!.notify}>
              <WishlistProvider notify={toast!.notify}>{children}</WishlistProvider>
            </CartProvider>
          </PreferencesProvider>
        </AuthProvider>
      )}
    </ToastContext.Consumer>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <StoreProviders>{children}</StoreProviders>
    </ToastProvider>
  );
}
