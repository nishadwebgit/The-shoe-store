import type {
  Cart,
  CartLine,
  CartTotals,
  Category,
  CreateOrderRequest,
  Customer,
  DeliveryMethodId,
  HostedCheckout,
  Order,
  PaymentOptions,
  Product,
  ProductQuery,
  ProductSearchResult,
  RegisterRequest,
  Review,
  ShippingOption,
  SignInRequest,
  StockCheckResult,
} from '../../types';
import { readStorage, removeStorage, storageKeys, writeStorage } from '../../utils/storage';
import {
  ServiceError,
  type IAuthService,
  type ICartService,
  type ICheckoutService,
  type IInventoryService,
  type IOrderService,
  type IPaymentService,
  type IProductService,
  type IWishlistService,
} from '../interfaces';
import { apiRequest, apiRequestOrNull, cartTokenStore, lastAuthResponse, refreshSession, toQueryString, tokenStore } from './apiClient';

/**
 * HTTP implementations of the service contracts, backed by the Nishoes ASP.NET Core Web API
 * (shoe-store-api). The API's DTOs mirror src/types, so most responses are used as-is.
 */

// ---------------------------------------------------------------- API response shapes that differ from the UI types

interface ApiCartTotals {
  itemCount: number;
  subtotal: number;
  saleSavings: number;
  discount: number;
  discountCode?: string | null;
  discountDescription?: string | null;
  discountError?: string | null;
  shipping: number;
  total: number;
  amountToFreeShipping: number;
}

interface ApiCart {
  cartToken?: string | null;
  lines: CartLine[];
  discountCode?: string | null;
  updatedAt: string;
  totals: ApiCartTotals;
}

interface ApiAuthResponse {
  accessToken: string;
  expiresAt: string;
  customer: Customer;
}

interface ApiShippingMethod {
  id: DeliveryMethodId;
  label: string;
  description: string;
  fee: number;
  available: boolean;
  estimatedDelivery: { from: string; to: string };
}

interface ApiPaged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface ApiWishlist {
  productIds: string[];
}

export function mapTotals(t: ApiCartTotals): CartTotals {
  return {
    itemCount: t.itemCount,
    subtotal: t.subtotal,
    saleSavings: t.saleSavings,
    discount: t.discount,
    // Only code and description are displayed; the server owns the discount rules.
    discountCode: t.discountCode
      ? { code: t.discountCode, description: t.discountDescription ?? '', type: 'fixed', value: t.discount }
      : undefined,
    discountError: t.discountError ?? undefined,
    shipping: t.shipping,
    total: t.total,
    amountToFreeShipping: t.amountToFreeShipping,
  };
}

function mapCart(c: ApiCart): Cart {
  // Guests receive an anonymous token the first time they add to the bag; keep it for later requests.
  if (c.cartToken && !tokenStore.get()) cartTokenStore.set(c.cartToken);
  return {
    lines: c.lines,
    discountCode: c.discountCode ?? undefined,
    updatedAt: c.updatedAt,
    totals: mapTotals(c.totals),
  };
}

// ---------------------------------------------------------------- Catalogue

/** Largest page the API returns (ProductService.MaxPageSize). */
const API_MAX_PAGE_SIZE = 48;

export class HttpProductService implements IProductService {
  async searchProducts(q: ProductQuery): Promise<ProductSearchResult> {
    // The UI uses "load more": page N shows everything up to N. One request covers it while it fits the
    // API's page-size cap; beyond that, the pages are fetched in parallel and joined.
    const page = Math.max(1, q.page ?? 1);
    const pageSize = q.pageSize ?? 12;
    const filters = {
      search: q.search?.trim(),
      gender: q.genders,
      category: q.categories,
      brand: q.brands,
      size: q.sizes,
      colour: q.colours,
      minPrice: q.minPrice,
      maxPrice: q.maxPrice,
      minRating: q.minRating,
      inStock: q.inStockOnly,
      onSale: q.onSaleOnly,
      collection: q.collection,
      sort: q.sort,
    };
    const fetchPage = (p: number, size: number) =>
      apiRequest<ProductSearchResult>(`/products${toQueryString({ ...filters, page: p, pageSize: size })}`);

    let result: ProductSearchResult;
    if (page * pageSize <= API_MAX_PAGE_SIZE) {
      result = await fetchPage(1, page * pageSize);
    } else {
      const pages = await Promise.all(Array.from({ length: page }, (_, i) => fetchPage(i + 1, pageSize)));
      // The API clamps out-of-range pages to the last page, so drop repeats.
      const seen = new Set<string>();
      const items = pages.flatMap((r) => r.items).filter((p) => !seen.has(p.id) && Boolean(seen.add(p.id)));
      result = { ...pages[0], items };
    }
    const totalPages = Math.max(1, Math.ceil(result.totalCount / pageSize));
    return { ...result, page: Math.min(page, totalPages), pageSize, totalPages };
  }

  getProductBySlug(slug: string) {
    return apiRequestOrNull<Product>(`/products/${encodeURIComponent(slug)}`);
  }

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const result = await apiRequest<ProductSearchResult>(`/products${toQueryString({ ids: ids.slice(0, API_MAX_PAGE_SIZE), pageSize: API_MAX_PAGE_SIZE })}`);
    const byId = new Map(result.items.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  }

  getCategories() {
    return apiRequest<Category[]>('/categories');
  }

  getCollection(collection: 'featured' | 'new' | 'best-sellers' | 'sale', limit = 8) {
    const path = { featured: 'featured', new: 'new-arrivals', 'best-sellers': 'best-sellers', sale: 'sale' }[collection];
    return apiRequest<Product[]>(`/products/${path}${toQueryString({ limit })}`);
  }

  getRelatedProducts(productId: string, limit = 4) {
    return apiRequest<Product[]>(`/products/${encodeURIComponent(productId)}/related${toQueryString({ limit })}`);
  }

  getRecommendations(excludeIds: string[], limit = 4) {
    return apiRequest<Product[]>(`/products/recommendations${toQueryString({ exclude: excludeIds, limit })}`);
  }

  getReviews(productId: string) {
    return apiRequest<Review[]>(`/products/${encodeURIComponent(productId)}/reviews`);
  }

  async getBrands() {
    const brands = await apiRequest<{ name: string; productCount: number }[]>('/brands');
    return brands.filter((b) => b.productCount > 0).map((b) => b.name);
  }
}

export class HttpInventoryService implements IInventoryService {
  checkStock(skus: string[]) {
    return apiRequest<StockCheckResult[]>('/inventory/check', { method: 'POST', body: { skus } });
  }
}

// ---------------------------------------------------------------- Cart

export class HttpCartService implements ICartService {
  private async call(path: string, init: { method?: string; body?: unknown } = {}): Promise<Cart> {
    return mapCart(await apiRequest<ApiCart>(path, { ...init, withCartToken: true }));
  }

  getCart() {
    return this.call('/cart');
  }
  addItem(input: { productId: string; colourId: string; size: string; quantity: number }) {
    return this.call('/cart/items', { method: 'POST', body: input });
  }
  updateQuantity(lineId: string, quantity: number) {
    return this.call(`/cart/items/${encodeURIComponent(lineId)}`, { method: 'PUT', body: { quantity } });
  }
  removeItem(lineId: string) {
    return this.call(`/cart/items/${encodeURIComponent(lineId)}`, { method: 'DELETE' });
  }
  applyDiscount(code: string) {
    if (!code.trim()) return Promise.reject(new ServiceError('empty-code', 'Enter a discount code.'));
    return this.call('/cart/coupon', { method: 'POST', body: { code: code.trim() } });
  }
  removeDiscount() {
    return this.call('/cart/coupon', { method: 'DELETE' });
  }
  clear() {
    return this.call('/cart', { method: 'DELETE' });
  }

  /** After sign-in: move the guest bag into the customer's bag. */
  async mergeGuestCart(): Promise<void> {
    const guestToken = cartTokenStore.get();
    if (!guestToken) return;
    try {
      await apiRequest<ApiCart>('/cart/merge', { method: 'POST', headers: { 'X-Cart-Token': guestToken } });
    } finally {
      cartTokenStore.set(null);
    }
  }
}

// ---------------------------------------------------------------- Wishlist

/**
 * The API stores wishlists for signed-in customers. Guests keep a local wishlist, which is merged
 * into their account when they sign in.
 */
export class HttpWishlistService implements IWishlistService {
  private local(): string[] {
    return readStorage<string[]>(storageKeys.wishlist, []);
  }

  async getProductIds(): Promise<string[]> {
    if (!tokenStore.get()) return this.local();
    return (await apiRequest<ApiWishlist>('/wishlist')).productIds;
  }

  async add(productId: string): Promise<string[]> {
    if (!tokenStore.get()) {
      const ids = this.local();
      const next = ids.includes(productId) ? ids : [productId, ...ids];
      writeStorage(storageKeys.wishlist, next);
      return next;
    }
    return (await apiRequest<ApiWishlist>('/wishlist/items', { method: 'POST', body: { productId } })).productIds;
  }

  async remove(productId: string): Promise<string[]> {
    if (!tokenStore.get()) {
      const next = this.local().filter((id) => id !== productId);
      writeStorage(storageKeys.wishlist, next);
      return next;
    }
    return (await apiRequest<ApiWishlist>(`/wishlist/items/${encodeURIComponent(productId)}`, { method: 'DELETE' })).productIds;
  }

  /** After sign-in: save the guest wishlist to the account, then clear the local copy. */
  async mergeGuestWishlist(): Promise<void> {
    const ids = this.local();
    if (ids.length === 0) return;
    await apiRequest<ApiWishlist>('/wishlist/merge', { method: 'POST', body: { productIds: ids } });
    removeStorage(storageKeys.wishlist);
  }
}

// ---------------------------------------------------------------- Auth & customers

export class HttpAuthService implements IAuthService {
  private customer: Customer | null = null;
  private restored = false;
  private readonly cart: HttpCartService;
  private readonly wishlist: HttpWishlistService;

  constructor(cart: HttpCartService, wishlist: HttpWishlistService) {
    this.cart = cart;
    this.wishlist = wishlist;
  }

  private async startSession(response: ApiAuthResponse) {
    tokenStore.set(response.accessToken);
    this.customer = response.customer;
    // Bring over anything the shopper did as a guest. Failures here must not block sign-in.
    await Promise.allSettled([this.cart.mergeGuestCart(), this.wishlist.mergeGuestWishlist()]);
    return { session: { customerId: response.customer.id, token: 'in-memory', expiresAt: response.expiresAt }, customer: response.customer };
  }

  async register(request: RegisterRequest) {
    const response = await apiRequest<ApiAuthResponse>('/auth/register', { method: 'POST', body: request, skipAuthRefresh: true });
    return this.startSession(response);
  }

  async signIn(request: SignInRequest) {
    const response = await apiRequest<ApiAuthResponse>('/auth/login', {
      method: 'POST',
      body: { email: request.email.trim(), password: request.password },
      skipAuthRefresh: true,
    });
    return this.startSession(response);
  }

  async signOut() {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST', skipAuthRefresh: true });
    } finally {
      tokenStore.set(null);
      this.customer = null;
    }
  }

  async getCurrentCustomer(): Promise<Customer | null> {
    if (!tokenStore.get() && !this.restored) {
      // First load: restore the session from the HttpOnly refresh-token cookie, if there is one.
      this.restored = true;
      const ok = await refreshSession();
      if (ok) this.customer = (lastAuthResponse as ApiAuthResponse | null)?.customer ?? null;
    }
    if (!tokenStore.get()) return null;
    this.customer = await apiRequest<Customer>('/customers/profile');
    return this.customer;
  }

  async updateProfile(changes: Partial<Omit<Customer, 'id' | 'email' | 'createdAt'>>): Promise<Customer> {
    const current = this.customer ?? (await this.getCurrentCustomer());
    if (!current) throw new ServiceError('not-signed-in', 'Your session has ended. Sign in again to update your details.');
    const merged = { ...current, ...changes };
    this.customer = await apiRequest<Customer>('/customers/profile', {
      method: 'PUT',
      body: {
        firstName: merged.firstName,
        lastName: merged.lastName,
        phone: merged.phone || null,
        preferredSize: merged.preferredSize || null,
        marketingOptIn: merged.marketingOptIn,
      },
    });
    return this.customer;
  }

  onSessionChange(listener: (signedIn: boolean) => void) {
    return tokenStore.subscribe(listener);
  }
}

// ---------------------------------------------------------------- Checkout & orders

function rememberGuestOrder(orderNumber: string, email: string) {
  const map = readStorage<Record<string, string>>(storageKeys.guestOrders, {});
  map[orderNumber] = email;
  writeStorage(storageKeys.guestOrders, map);
}

export class HttpCheckoutService implements ICheckoutService {
  async getShippingOptions(input: { district?: string; subtotal: number; couponCode?: string }): Promise<ShippingOption[]> {
    const methods = await apiRequest<ApiShippingMethod[]>(
      `/shipping-methods${toQueryString({ subtotal: input.subtotal, district: input.district, couponCode: input.couponCode })}`,
    );
    return methods.map((m) => ({
      id: m.id,
      label: m.label,
      description: m.description,
      fee: m.fee,
      available: m.available,
      estimatedDelivery: m.estimatedDelivery,
    }));
  }

  async quote(input: { deliveryMethod: DeliveryMethodId; district?: string; couponCode?: string }): Promise<CartTotals> {
    return mapTotals(
      await apiRequest<ApiCartTotals>('/checkout/quote', {
        method: 'POST',
        withCartToken: true,
        body: { deliveryMethod: input.deliveryMethod, district: input.district || null, couponCode: input.couponCode || null },
      }),
    );
  }
}

export class HttpOrderService implements IOrderService {
  async createOrder(request: CreateOrderRequest): Promise<Order> {
    // Only the shopper's choices are sent. The server prices the order from its own cart and catalogue.
    const order = await apiRequest<Order>('/checkout', {
      method: 'POST',
      withCartToken: true,
      body: {
        email: request.email.trim(),
        shippingAddress: request.shippingAddress,
        deliveryMethod: request.deliveryMethod,
        couponCode: request.discountCode ?? null,
        saveAddress: Boolean(request.saveAddress && request.customerId),
        paymentMethod: request.paymentMethod ?? null,
      },
    });
    if (!order.customerId) rememberGuestOrder(order.orderNumber, order.email);
    return order;
  }

  async getOrdersForCustomer(): Promise<Order[]> {
    const page = await apiRequest<ApiPaged<Order>>('/orders?pageSize=50');
    return page.items;
  }

  async getOrder(orderNumber: string) {
    const email = guestOrderEmail(orderNumber);
    // Returning from a payment page is a fresh page load: restore the session before asking for a member order.
    if (!email && !tokenStore.get()) await refreshSession();
    return apiRequestOrNull<Order>(`/orders/${encodeURIComponent(orderNumber)}${toQueryString({ email })}`);
  }
}

function guestOrderEmail(orderNumber: string): string | undefined {
  return readStorage<Record<string, string>>(storageKeys.guestOrders, {})[orderNumber];
}

export class HttpPaymentService implements IPaymentService {
  getOptions() {
    return apiRequest<PaymentOptions>('/payments/options');
  }

  async startPayHereCheckout(orderNumber: string) {
    const email = guestOrderEmail(orderNumber);
    if (!email && !tokenStore.get()) await refreshSession();
    return apiRequest<HostedCheckout>('/payments/payhere/checkout', { method: 'POST', body: { orderNumber, email: email ?? null } });
  }
}
