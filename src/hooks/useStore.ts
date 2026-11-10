import { useContext, type Context } from 'react';
import {
  AuthContext,
  CartContext,
  PreferencesContext,
  ToastContext,
  WishlistContext,
} from '../context/contexts';

function useRequired<T>(context: Context<T | null>, name: string): T {
  const value = useContext(context);
  if (!value) throw new Error(`${name} must be used inside its provider (see AppProviders).`);
  return value;
}

export const useCart = () => useRequired(CartContext, 'useCart');
export const useWishlist = () => useRequired(WishlistContext, 'useWishlist');
export const useAuth = () => useRequired(AuthContext, 'useAuth');
export const useToast = () => useRequired(ToastContext, 'useToast');
export const usePreferences = () => useRequired(PreferencesContext, 'usePreferences');
