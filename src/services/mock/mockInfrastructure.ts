import { appConfig } from '../../config/appConfig';
import { products as catalogue } from '../../data/products';
import type { Product } from '../../types';
import { readStorage, storageKeys, writeStorage } from '../../utils/storage';

/** Simulates network latency so loading states behave as they will with the real API. */
export function delay<T>(value: T, ms: number = appConfig.mockLatencyMs): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Quantity sold per SKU in this browser, so demo orders reduce visible stock. */
type InventoryAdjustments = Record<string, number>;

export function getAdjustments(): InventoryAdjustments {
  return readStorage<InventoryAdjustments>(storageKeys.inventory, {});
}

export function recordSale(lines: { sku: string; quantity: number }[]): void {
  const adjustments = getAdjustments();
  for (const line of lines) adjustments[line.sku] = (adjustments[line.sku] ?? 0) + line.quantity;
  writeStorage(storageKeys.inventory, adjustments);
}

/** Returns the catalogue with per-browser stock adjustments applied. */
export function getCatalogue(): Product[] {
  const adjustments = getAdjustments();
  if (Object.keys(adjustments).length === 0) return catalogue;
  return catalogue.map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({ ...v, stock: Math.max(0, v.stock - (adjustments[v.sku] ?? 0)) })),
  }));
}

export function findVariant(productId: string, colourId: string, size: string) {
  const product = getCatalogue().find((p) => p.id === productId);
  const variant = product?.variants.find((v) => v.colourId === colourId && v.size === size);
  return { product, variant };
}

export function findSku(sku: string) {
  for (const product of getCatalogue()) {
    const variant = product.variants.find((v) => v.sku === sku);
    if (variant) return { product, variant };
  }
  return { product: undefined, variant: undefined };
}
