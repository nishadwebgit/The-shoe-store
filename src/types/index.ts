// Core domain types. These mirror the DTOs the future ASP.NET Core Web API should return,
// so mock services and HTTP services can share the same contracts.

export type Gender = 'men' | 'women' | 'kids' | 'unisex';

export type StyleCategory =
  | 'running'
  | 'sports'
  | 'casual'
  | 'lifestyle'
  | 'trail'
  | 'formal'
  | 'sandals'
  | 'boots';

export type Silhouette =
  | 'runner'
  | 'trail'
  | 'court'
  | 'hightop'
  | 'boot'
  | 'sandal'
  | 'loafer'
  | 'kids';

export interface ColourOption {
  id: string;
  name: string;
  /** Hex used for the swatch. */
  swatch: string;
  /** Colour family used by the colour filter, e.g. "black". */
  family: string;
  /** Image URLs for this colourway (first = primary). */
  images: string[];
}

export interface Variant {
  /** Stable SKU, e.g. "P001-BLK-8". */
  sku: string;
  colourId: string;
  size: string;
  stock: number;
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  brand: string;
  gender: Gender;
  categories: StyleCategory[];
  description: string;
  highlights: string[];
  /** Current selling price in minor-unit-free LKR (whole rupees). */
  price: number;
  /** Original price when discounted. */
  originalPrice?: number;
  colours: ColourOption[];
  /** All sizes this product is made in (ordered). */
  sizes: string[];
  sizeSystem: SizeSystem;
  variants: Variant[];
  rating: number;
  reviewCount: number;
  specifications: ProductSpecification[];
  materials: string;
  care: string;
  fit: 'small' | 'true' | 'large';
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  /** ISO date used for "newest" sorting. */
  releasedAt: string;
  /** Popularity score used for "popular" sorting. */
  popularity: number;
  silhouette: Silhouette;
}

export type SizeSystem = 'adult' | 'kids';

export interface Category {
  id: string;
  label: string;
  description: string;
  /** Number of products in the category (API only). */
  productCount?: number;
  /** Query string applied on the shop page. */
  query: Record<string, string>;
  image: string;
}

export type SortOption = 'featured' | 'newest' | 'popular' | 'price-asc' | 'price-desc' | 'rating';

export interface ProductQuery {
  search?: string;
  genders?: Gender[];
  categories?: StyleCategory[];
  brands?: string[];
  sizes?: string[];
  colours?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly?: boolean;
  onSaleOnly?: boolean;
  collection?: 'new' | 'best-sellers' | 'featured';
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface FacetValue {
  value: string;
  label: string;
  count: number;
}

export interface ProductFacets {
  genders: FacetValue[];
  categories: FacetValue[];
  brands: FacetValue[];
  sizes: { adult: FacetValue[]; kids: FacetValue[] };
  colours: (FacetValue & { swatch: string })[];
  priceRange: { min: number; max: number };
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface ProductSearchResult extends PagedResult<Product> {
  facets: ProductFacets;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  location: string;
  rating: number;
  title: string;
  body: string;
  fit: 'small' | 'true' | 'large';
  sizePurchased: string;
  createdAt: string;
  verified: boolean;
}

// ---------- Cart ----------

export interface CartLine {
  /** Stable line id = sku. */
  id: string;
  sku: string;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  colourId: string;
  colourName: string;
  size: string;
  image: string;
  unitPrice: number;
  originalUnitPrice?: number;
  quantity: number;
  /** Stock available for this variant when last checked. */
  maxQuantity: number;
}

export interface Cart {
  lines: CartLine[];
  discountCode?: string;
  updatedAt: string;
  /** Totals calculated by the server (API mode). When absent the UI calculates a local preview. */
  totals?: CartTotals;
}

export type DeliveryMethodId = 'standard' | 'express' | 'pickup';

export interface DeliveryMethod {
  id: DeliveryMethodId;
  label: string;
  description: string;
  minBusinessDays: number;
  maxBusinessDays: number;
  baseFee: number;
  /** Whether the free-shipping threshold applies to this method. */
  freeOverThreshold: boolean;
}

export interface DiscountCode {
  code: string;
  description: string;
  type: 'percent' | 'fixed' | 'free-shipping';
  value: number;
  minSubtotal?: number;
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  /** Savings from sale prices (informational). */
  saleSavings: number;
  discount: number;
  discountCode?: DiscountCode;
  discountError?: string;
  shipping: number;
  total: number;
  amountToFreeShipping: number;
}

// ---------- Customers & orders ----------

export interface Address {
  /** Saved-address id (API). */
  id?: number;
  isDefault?: boolean;
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  district: string;
  postalCode: string;
  phone: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  createdAt: string;
  defaultAddress?: Address;
  preferredSize?: string;
  marketingOptIn: boolean;
  role?: string;
}

export interface AuthSession {
  customerId: string;
  /** Demo token. A real API would issue a JWT; never trust this value. */
  token: string;
  expiresAt: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  marketingOptIn: boolean;
}

export interface SignInRequest {
  email: string;
  password: string;
}

/** Fulfilment status (separate from payment status). */
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'ready-for-dispatch' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderLine {
  sku: string;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  colourName: string;
  size: string;
  image: string;
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  email: string;
  placedAt: string;
  status: OrderStatus;
  lines: OrderLine[];
  shippingAddress: Address;
  deliveryMethod: DeliveryMethodId;
  estimatedDelivery: { from: string; to: string };
  subtotal: number;
  discount: number;
  discountCode?: string;
  shipping: number;
  total: number;
  /** "demo" for simulated payments, otherwise the gateway, e.g. "payhere". */
  paymentMethod: string;
  /** "simulated" | "pending" | "paid" | "failed" | "refunded" (API). */
  paymentStatus?: PaymentStatus;
  /** Gateway name, e.g. "PayHere" or "Simulated". */
  paymentProvider?: string;
  /** While a card payment is outstanding: when the reserved items are released. */
  paymentExpiresAt?: string | null;
}

export type PaymentStatus = 'simulated' | 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethodChoice = 'payhere' | 'simulated';

export interface PaymentOptions {
  cardPaymentsEnabled: boolean;
  simulatedPaymentsEnabled: boolean;
  sandbox: boolean;
}

/** A signed form the browser posts to the gateway's hosted checkout page. */
export interface HostedCheckout {
  actionUrl: string;
  fields: Record<string, string>;
  expiresAt?: string | null;
}

export interface CreateOrderRequest {
  email: string;
  customerId?: string;
  shippingAddress: Address;
  deliveryMethod: DeliveryMethodId;
  lines: CartLine[];
  discountCode?: string;
  /** Save the shipping address as the customer's default address. */
  saveAddress?: boolean;
  paymentMethod?: PaymentMethodChoice;
}

export interface ShippingOption {
  id: DeliveryMethodId;
  label: string;
  description: string;
  fee: number;
  available: boolean;
  estimatedDelivery: { from: string; to: string };
}

export interface StockCheckResult {
  sku: string;
  available: number;
}
