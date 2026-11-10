import { appConfig } from '../config/appConfig';
import { apiRequest, refreshSession, toQueryString, tokenStore } from '../services/http/apiClient';
import { ServiceError } from '../services/interfaces';
import type {
  AdjustmentType,
  AdminCustomer,
  AdminOrder,
  AdminOrderCounts,
  AdminOrderListItem,
  AdminOrderStatus,
  AdminProduct,
  AdminProductListItem,
  Dashboard,
  InventoryItem,
  InventoryTransaction,
  Lookups,
  Paged,
  ProductRequest,
  StockReceipt,
  StockReceiptRequest,
  StockReceiptSummary,
  StoreSettings,
  Supplier,
  UploadedImage,
} from './types';

/* Owner Portal API client. Uses the storefront's authenticated client (access token + refresh cookie). */

type Query = Record<string, string | number | boolean | undefined | null>;
const q = (params: Query) => toQueryString(params);

export const adminApi = {
  dashboard: () => apiRequest<Dashboard>('/admin/dashboard'),
  lookups: () => apiRequest<Lookups>('/admin/lookups'),

  products: (params: Query) => apiRequest<Paged<AdminProductListItem>>(`/admin/products${q(params)}`),
  product: (id: number) => apiRequest<AdminProduct>(`/admin/products/${id}`),
  createProduct: (body: ProductRequest) => apiRequest<AdminProduct>('/admin/products', { method: 'POST', body }),
  updateProduct: (id: number, body: ProductRequest) => apiRequest<AdminProduct>(`/admin/products/${id}`, { method: 'PUT', body }),
  setProductStatus: (id: number, body: { isActive?: boolean; isFeatured?: boolean }) =>
    apiRequest<AdminProduct>(`/admin/products/${id}/status`, { method: 'PATCH', body }),
  addColour: (id: number, body: { name: string; swatch: string; family: string }) =>
    apiRequest<AdminProduct>(`/admin/products/${id}/colours`, { method: 'POST', body }),
  deleteProduct: (id: number) => apiRequest<void>(`/admin/products/${id}`, { method: 'DELETE' }),

  receiveStock: (body: StockReceiptRequest) => apiRequest<StockReceipt>('/admin/stock-receipts', { method: 'POST', body }),
  receipts: (params: Query) => apiRequest<Paged<StockReceiptSummary>>(`/admin/stock-receipts${q(params)}`),
  receipt: (id: number) => apiRequest<StockReceipt>(`/admin/stock-receipts/${id}`),

  inventory: (params: Query) => apiRequest<Paged<InventoryItem>>(`/admin/inventory${q(params)}`),
  adjustStock: (variantId: number, body: { type: AdjustmentType; change: number; reason: string }) =>
    apiRequest<{ item: InventoryItem; transaction: InventoryTransaction }>(`/admin/inventory/${variantId}/adjustments`, { method: 'POST', body }),
  setThreshold: (variantId: number, threshold: number | null) =>
    apiRequest<InventoryItem>(`/admin/inventory/${variantId}/threshold`, { method: 'PUT', body: { threshold } }),
  transactions: (params: Query) => apiRequest<Paged<InventoryTransaction>>(`/admin/inventory/transactions${q(params)}`),

  suppliers: () => apiRequest<Supplier[]>('/admin/suppliers'),
  saveSupplier: (id: number | null, body: Omit<Supplier, 'id' | 'receiptCount' | 'lastReceiptAt'>) =>
    apiRequest<Supplier>(id ? `/admin/suppliers/${id}` : '/admin/suppliers', { method: id ? 'PUT' : 'POST', body }),
  settings: () => apiRequest<StoreSettings>('/admin/settings'),
  updateSettings: (body: { lowStockThreshold: number }) => apiRequest<StoreSettings>('/admin/settings', { method: 'PUT', body }),

  orders: (params: Query) => apiRequest<Paged<AdminOrderListItem>>(`/admin/orders${q(params)}`),
  orderCounts: () => apiRequest<AdminOrderCounts>('/admin/orders/counts'),
  order: (orderNumber: string) => apiRequest<AdminOrder>(`/admin/orders/${encodeURIComponent(orderNumber)}`),
  updateOrderStatus: (orderNumber: string, status: AdminOrderStatus, note?: string) =>
    apiRequest<AdminOrder>(`/admin/orders/${encodeURIComponent(orderNumber)}/status`, { method: 'POST', body: { status, note: note || null } }),
  customers: (params: Query) => apiRequest<Paged<AdminCustomer>>(`/admin/customers${q(params)}`),
};

/**
 * Uploads one image with progress events (fetch has no upload progress, so this uses XMLHttpRequest).
 * Retries once after refreshing the session if the access token has expired.
 */
export function uploadImage(file: File, onProgress: (percent: number) => void): Promise<UploadedImage> {
  const send = () =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${appConfig.apiBaseUrl}/admin/media/images`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Accept', 'application/json');
      const token = tokenStore.get();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
      xhr.onerror = () => reject(new ServiceError('network', 'The upload failed. Check your connection and try again.'));
      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });

  return (async () => {
    let result = await send();
    if (result.status === 401 && (await refreshSession())) result = await send();
    if (result.status >= 200 && result.status < 300) return JSON.parse(result.body) as UploadedImage;
    let message = 'The image couldn’t be uploaded. Try a different file.';
    try {
      const problem = JSON.parse(result.body) as { detail?: string; errors?: Record<string, string[]> };
      message = (problem.errors && Object.values(problem.errors).flat()[0]) || problem.detail || message;
    } catch {
      if (result.status === 413) message = 'That image is too large. Images can be up to 5 MB.';
    }
    throw new ServiceError(`http-${result.status}`, message);
  })();
}

/** Random id for idempotent submissions (one per stock receipt form). */
export function newRequestId(): string {
  return crypto.randomUUID();
}

export const orderStatusLabels: Record<AdminOrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  processing: 'Processing',
  'ready-for-dispatch': 'Ready for dispatch',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export const orderActionLabels: Record<AdminOrderStatus, string> = {
  pending: 'Mark pending',
  confirmed: 'Confirm order',
  processing: 'Start processing',
  'ready-for-dispatch': 'Ready for dispatch',
  shipped: 'Mark as shipped',
  delivered: 'Mark as delivered',
  cancelled: 'Cancel order',
};

export const paymentLabels: Record<string, string> = {
  simulated: 'Demo',
  pending: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

export const transactionLabels: Record<string, string> = {
  received: 'Received',
  sale: 'Sale',
  released: 'Released',
  correction: 'Correction',
  damaged: 'Damaged',
  lost: 'Lost',
  returned: 'Returned',
};
