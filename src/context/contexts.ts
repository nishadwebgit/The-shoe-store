import { createContext } from 'react';
import type { Cart, CartTotals, Customer, DeliveryMethodId, RegisterRequest, SignInRequest } from '../types';

export interface CartContextValue {
  cart: Cart;
  totals: CartTotals;
  ready: boolean;
  /** Line ids currently being updated (for disabling controls). */
  pending: Set<string>;
  addItem: (input: { productId: string; colourId: string; size: string; quantity: number }) => Promise<boolean>;
  updateQuantity: (lineId: string, quantity: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  applyDiscount: (code: string) => Promise<string | undefined>;
  removeDiscount: () => Promise<void>;
  clear: () => Promise<void>;
  /** Reload the bag from the service (e.g. after an order is placed). */
  reload: () => void;
  totalsFor: (method: DeliveryMethodId) => CartTotals;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

export interface WishlistContextValue {
  ids: string[];
  has: (productId: string) => boolean;
  toggle: (productId: string, productName?: string) => Promise<void>;
  remove: (productId: string) => Promise<void>;
}

export interface AuthContextValue {
  customer: Customer | null;
  ready: boolean;
  signIn: (request: SignInRequest) => Promise<Customer>;
  register: (request: RegisterRequest) => Promise<Customer>;
  signOut: () => Promise<void>;
  updateProfile: (changes: Partial<Omit<Customer, 'id' | 'email' | 'createdAt'>>) => Promise<Customer>;
  /** Re-read the signed-in customer (e.g. after checkout saved a new default address). */
  refresh: () => Promise<Customer | null>;
}

export type ToastTone = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; to: string };
}
export interface ToastContextValue {
  notify: (message: string, tone?: ToastTone, action?: Toast['action']) => void;
}

export interface PreferencesContextValue {
  preferredSize: string | null;
  setPreferredSize: (size: string | null) => void;
  recentlyViewed: string[];
  addRecentlyViewed: (productId: string) => void;
}

export const CartContext = createContext<CartContextValue | null>(null);
export const WishlistContext = createContext<WishlistContextValue | null>(null);
export const AuthContext = createContext<AuthContextValue | null>(null);
export const ToastContext = createContext<ToastContextValue | null>(null);
export const PreferencesContext = createContext<PreferencesContextValue | null>(null);
