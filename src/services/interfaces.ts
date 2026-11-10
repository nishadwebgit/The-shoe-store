import type {
  AuthSession,
  Cart,
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
} from '../types';

/**
 * Service contracts used by the UI. The UI only ever talks to these interfaces through the
 * registry in `services/index.ts`. To integrate the ASP.NET Core Web API, implement each
 * interface with HTTP calls (see `services/http`) and switch the registry.
 *
 * Suggested API endpoints are noted on each method.
 */

export interface IProductService {
  /** GET /api/v1/products?search=&gender=&category=&brand=&size=&colour=&minPrice=&maxPrice=&minRating=&inStock=&sort=&page=&pageSize= */
  searchProducts(query: ProductQuery): Promise<ProductSearchResult>;
  /** GET /api/v1/products/{idOrSlug} */
  getProductBySlug(slug: string): Promise<Product | undefined>;
  /** GET /api/v1/products?ids=P001,P002 */
  getProductsByIds(ids: string[]): Promise<Product[]>;
  /** GET /api/v1/categories */
  getCategories(): Promise<Category[]>;
  /** GET /api/v1/products/{featured|new-arrivals|best-sellers|sale} */
  getCollection(collection: 'featured' | 'new' | 'best-sellers' | 'sale', limit?: number): Promise<Product[]>;
  /** GET /api/v1/products/{id}/related */
  getRelatedProducts(productId: string, limit?: number): Promise<Product[]>;
  /** GET /api/v1/products/recommendations?exclude= */
  getRecommendations(excludeIds: string[], limit?: number): Promise<Product[]>;
  /** GET /api/v1/products/{id}/reviews */
  getReviews(productId: string): Promise<Review[]>;
  /** GET /api/v1/brands */
  getBrands(): Promise<string[]>;
}

export interface IInventoryService {
  /** POST /api/v1/inventory/check { skus: [] } */
  checkStock(skus: string[]): Promise<StockCheckResult[]>;
}

export interface ICartService {
  /** GET /api/v1/cart */
  getCart(): Promise<Cart>;
  /** POST /api/v1/cart/items */
  addItem(input: { productId: string; colourId: string; size: string; quantity: number }): Promise<Cart>;
  /** PUT /api/v1/cart/items/{sku} */
  updateQuantity(lineId: string, quantity: number): Promise<Cart>;
  /** DELETE /api/v1/cart/items/{sku} */
  removeItem(lineId: string): Promise<Cart>;
  /** POST /api/v1/cart/coupon { code } */
  applyDiscount(code: string): Promise<Cart>;
  /** DELETE /api/v1/cart/coupon */
  removeDiscount(): Promise<Cart>;
  /** DELETE /api/v1/cart */
  clear(): Promise<Cart>;
}

export interface IWishlistService {
  /** GET /api/v1/wishlist */
  getProductIds(): Promise<string[]>;
  /** POST /api/v1/wishlist/items { productId } (guests: local until sign-in) */
  add(productId: string): Promise<string[]>;
  /** DELETE /api/v1/wishlist/items/{productId} */
  remove(productId: string): Promise<string[]>;
}

export interface IAuthService {
  /** POST /api/v1/auth/register */
  register(request: RegisterRequest): Promise<{ session: AuthSession; customer: Customer }>;
  /** POST /api/v1/auth/login */
  signIn(request: SignInRequest): Promise<{ session: AuthSession; customer: Customer }>;
  /** POST /api/v1/auth/logout */
  signOut(): Promise<void>;
  /** GET /api/v1/customers/profile (API mode restores the session from the refresh-token cookie first). */
  getCurrentCustomer(): Promise<Customer | null>;
  /** Subscribe to the session ending elsewhere (e.g. refresh token expired). Returns an unsubscribe function. */
  onSessionChange?(listener: (signedIn: boolean) => void): () => void;
  /** PUT /api/v1/customers/profile */
  updateProfile(changes: Partial<Omit<Customer, 'id' | 'email' | 'createdAt'>>): Promise<Customer>;
}

export interface IOrderService {
  /** POST /api/v1/checkout */
  createOrder(request: CreateOrderRequest): Promise<Order>;
  /** GET /api/v1/orders */
  getOrdersForCustomer(customerId: string): Promise<Order[]>;
  /** GET /api/v1/orders/{orderNumber} */
  getOrder(orderNumber: string): Promise<Order | undefined>;
}

export interface ICheckoutService {
  /** GET /api/v1/shipping-methods?subtotal=&district=&couponCode= */
  getShippingOptions(input: { district?: string; subtotal: number; couponCode?: string }): Promise<ShippingOption[]>;
  /** POST /api/v1/checkout/quote: totals for the current cart and a delivery method (server-calculated). */
  quote(input: { deliveryMethod: DeliveryMethodId; district?: string; couponCode?: string }): Promise<CartTotals>;
}

export interface IPaymentService {
  /** GET /api/v1/payments/options */
  getOptions(): Promise<PaymentOptions>;
  /** POST /api/v1/payments/payhere/checkout: signed fields for PayHere's hosted checkout page. */
  startPayHereCheckout(orderNumber: string): Promise<HostedCheckout>;
}

export interface IEngagementService {
  /** Not in the API yet: handled locally in both modes. */
  subscribe(email: string): Promise<void>;
  /** Not in the API yet: handled locally in both modes. */
  sendContactMessage(message: { name: string; email: string; topic: string; orderNumber?: string; message: string }): Promise<{ reference: string }>;
}

export interface ServiceRegistry {
  products: IProductService;
  inventory: IInventoryService;
  cart: ICartService;
  wishlist: IWishlistService;
  auth: IAuthService;
  orders: IOrderService;
  checkout: ICheckoutService;
  payments: IPaymentService;
  engagement: IEngagementService;
}

/** Error with a message that is safe to show to shoppers. */
export class ServiceError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
  }
}
