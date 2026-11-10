/* Owner Portal API contracts. Mirrors ShoeStore.Application/Dtos/AdminDtos.cs. */

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export type StockState = 'in' | 'low' | 'out';
export type AdminOrderStatus = 'pending' | 'confirmed' | 'processing' | 'ready-for-dispatch' | 'shipped' | 'delivered' | 'cancelled';
export type AdminPaymentStatus = 'simulated' | 'pending' | 'paid' | 'failed' | 'refunded';
export type TransactionType = 'received' | 'sale' | 'released' | 'correction' | 'damaged' | 'lost' | 'returned';
export type AdjustmentType = 'correction' | 'damaged' | 'lost' | 'returned';

export interface IdName {
  id: number;
  name: string;
}

export interface Lookups {
  brands: IdName[];
  categories: { code: string; name: string }[];
  sizes: { code: string; label: string; sizeSystem: 'adult' | 'kids' }[];
  colourFamilies: { value: string; label: string; swatch: string }[];
  suppliers: IdName[];
  silhouettes: string[];
  lowStockThreshold: number;
  nextProductCode: string;
}

export interface AdminProductListItem {
  id: number;
  code: string;
  slug: string;
  name: string;
  brand: string;
  categories: string[];
  gender: string;
  price: number;
  originalPrice: number | null;
  image: string | null;
  totalStock: number;
  variantCount: number;
  lowStockVariants: number;
  outOfStockVariants: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface AdminImage {
  id: number;
  url: string;
  altText: string | null;
  sortOrder: number;
}

export interface AdminColour {
  id: number;
  code: string;
  name: string;
  swatch: string;
  family: string;
  images: AdminImage[];
}

export interface AdminVariant {
  id: number;
  sku: string;
  colourId: number;
  colourName: string;
  size: string;
  sizeLabel: string;
  stock: number;
  lowStockThreshold: number | null;
  effectiveThreshold: number;
  stockState: StockState;
  updatedAt: string | null;
}

export interface AdminProduct {
  id: number;
  code: string;
  slug: string;
  name: string;
  brandId: number;
  brand: string;
  categories: string[];
  gender: 'men' | 'women' | 'kids' | 'unisex';
  sizeSystem: 'adult' | 'kids';
  fit: 'true' | 'small' | 'large';
  silhouette: string;
  description: string;
  materials: string;
  care: string;
  regularPrice: number;
  salePrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  highlights: string[];
  colours: AdminColour[];
  variants: AdminVariant[];
  totalStock: number;
  createdAt: string;
  updatedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  canDelete: boolean;
  deleteBlockedReason: string | null;
}

export interface ProductColourRequest {
  id: number | null;
  name: string;
  swatch: string;
  family: string;
  sizes: string[];
  images: { url: string; altText: string | null }[];
}

export interface ProductRequest {
  name: string;
  code: string | null;
  brandId: number | null;
  newBrandName: string | null;
  categories: string[];
  gender: string;
  sizeSystem: string;
  fit: string;
  silhouette: string;
  description: string;
  materials: string | null;
  care: string | null;
  regularPrice: number;
  salePrice: number | null;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  highlights: string[];
  colours: ProductColourRequest[];
}

export interface UploadedImage {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

export interface StockReceiptLine {
  sku: string;
  colour: string;
  size: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
}

export interface StockReceiptSummary {
  id: number;
  receiptNumber: string;
  supplier: string | null;
  supplierReference: string | null;
  receivedDate: string;
  productId: number | null;
  productCode: string;
  productName: string;
  totalQuantity: number;
  totalCost: number | null;
  receivedBy: string;
  createdAt: string;
}

export interface StockReceipt extends StockReceiptSummary {
  unitCost: number | null;
  sellingPrice: number;
  notes: string | null;
  lines: StockReceiptLine[];
}

export interface StockReceiptRequest {
  clientRequestId: string;
  productId: number;
  supplierId: number | null;
  supplierName: string | null;
  supplierReference: string | null;
  receivedDate: string;
  unitCost: number | null;
  sellingPrice: number | null;
  notes: string | null;
  lines: { colourId: number; size: string; quantity: number }[];
}

export interface InventoryItem {
  variantId: number;
  sku: string;
  productId: number;
  productCode: string;
  productName: string;
  brand: string;
  colour: string;
  swatch: string;
  size: string;
  available: number;
  held: number;
  lowStockThreshold: number | null;
  effectiveThreshold: number;
  stockState: StockState;
  productActive: boolean;
  image: string | null;
  lastUpdated: string | null;
}

export interface InventoryTransaction {
  id: number;
  createdAt: string;
  type: TransactionType;
  variantId: number | null;
  sku: string;
  productCode: string;
  productName: string;
  colour: string;
  size: string;
  change: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  reference: string | null;
  performedBy: string;
}

export interface Supplier {
  id: number;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  receiptCount: number;
  lastReceiptAt: string | null;
}

export interface StoreSettings {
  lowStockThreshold: number;
  updatedAt: string | null;
  updatedBy: string | null;
  owners: { email: string; name: string | null; hasAccount: boolean; lastLoginAt: string | null }[];
}

export interface AdminOrderListItem {
  orderNumber: string;
  customerName: string;
  email: string;
  isGuest: boolean;
  placedAt: string;
  total: number;
  currency: string;
  status: AdminOrderStatus;
  paymentStatus: AdminPaymentStatus;
  paymentMethod: string;
  itemCount: number;
  nextStatuses: AdminOrderStatus[];
}

export interface AdminOrderCounts {
  byStatus: Record<AdminOrderStatus, number>;
  awaitingPayment: number;
  total: number;
}

export interface AdminOrderLine {
  sku: string;
  productId: string;
  slug: string;
  name: string;
  brand: string;
  colourId: string;
  colourName: string;
  size: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface AdminOrder {
  order: {
    id: string;
    orderNumber: string;
    email: string;
    placedAt: string;
    status: AdminOrderStatus;
    paymentStatus: AdminPaymentStatus;
    paymentMethod: string;
    lines: AdminOrderLine[];
    shippingAddress: { firstName: string; lastName: string; line1: string; line2: string | null; city: string; district: string; postalCode: string; phone: string };
    deliveryMethod: string;
    deliveryMethodName: string;
    estimatedDelivery: { from: string; to: string };
    subtotal: number;
    discount: number;
    discountCode: string | null;
    shipping: number;
    total: number;
    currency: string;
    paymentProvider: string;
    paymentExpiresAt: string | null;
  };
  customer: { id: string | null; name: string; email: string; phone: string; isGuest: boolean; orderCount: number; memberSince: string | null };
  payments: {
    at: string;
    provider: string;
    paymentId: string | null;
    amount: number;
    currency: string;
    statusCode: number;
    status: string;
    method: string | null;
    signatureValid: boolean;
    message: string | null;
  }[];
  history: { status: AdminOrderStatus; note: string | null; by: string; at: string }[];
  nextStatuses: AdminOrderStatus[];
  paymentSettled: boolean;
  paymentBlockReason: string | null;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  joinedAt: string;
  lastLoginAt: string | null;
  role: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

export interface Dashboard {
  products: { total: number; active: number; inactive: number; featured: number };
  stock: { totalUnits: number; lowStockVariants: number; outOfStockVariants: number; outOfStockProducts: number; receivedLast7Days: number };
  orders: { total: number; pending: number; inProgress: number; readyForDispatch: number; shipped: number; completed: number; cancelled: number; awaitingPayment: number };
  sales: { revenueLast30Days: number; ordersLast30Days: number; averageOrderValue: number; currency: string };
  daily: { date: string; orders: number; revenue: number }[];
  lowStock: InventoryItem[];
  recentReceipts: StockReceiptSummary[];
  recentMovements: InventoryTransaction[];
  recentOrders: AdminOrderListItem[];
}
