import type { Product } from '../../types';

export function stockFor(product: Product, colourId: string, size: string): number {
  return product.variants.find((v) => v.colourId === colourId && v.size === size)?.stock ?? 0;
}

export function sizeStock(product: Product, colourId: string): Record<string, number> {
  const map: Record<string, number> = {};
  for (const size of product.sizes) map[size] = stockFor(product, colourId, size);
  return map;
}

export function colourInStock(product: Product, colourId: string): boolean {
  return product.variants.some((v) => v.colourId === colourId && v.stock > 0);
}

export function isProductInStock(product: Product): boolean {
  return product.variants.some((v) => v.stock > 0);
}

/** First colour with stock (falls back to the first colour). */
export function defaultColourId(product: Product): string {
  return product.colours.find((c) => colourInStock(product, c.id))?.id ?? product.colours[0].id;
}

export const LOW_STOCK = 3;

export function stockMessage(stock: number): { tone: 'out' | 'low' | 'in'; text: string } {
  if (stock <= 0) return { tone: 'out', text: 'Sold out in this size' };
  if (stock <= LOW_STOCK) return { tone: 'low', text: `Only ${stock} left in this size` };
  return { tone: 'in', text: 'In stock, ready to ship' };
}
