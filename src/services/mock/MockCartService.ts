import type { Cart, CartLine } from '../../types';
import { findDiscountCode, validateDiscountCode } from '../../utils/pricing';
import { readStorage, storageKeys, writeStorage } from '../../utils/storage';
import { ServiceError, type ICartService, type IWishlistService } from '../interfaces';
import { delay, findSku, findVariant } from './mockInfrastructure';

const MAX_PER_LINE = 10;

function emptyCart(): Cart {
  return { lines: [], updatedAt: new Date().toISOString() };
}

/** Cart persisted in localStorage. A real API would key the cart by customer or anonymous id. */
export class MockCartService implements ICartService {
  private load(): Cart {
    const cart = readStorage<Cart>(storageKeys.cart, emptyCart());
    // Re-validate against current stock each time the cart is read.
    const lines = cart.lines
      .map((line): CartLine | null => {
        const { product, variant } = findSku(line.sku);
        if (!product || !variant) return null;
        const max = Math.min(variant.stock, MAX_PER_LINE);
        return {
          ...line,
          unitPrice: product.price,
          originalUnitPrice: product.originalPrice,
          maxQuantity: max,
          quantity: Math.min(line.quantity, Math.max(max, 0)),
        };
      })
      .filter((l): l is CartLine => l !== null && l.quantity > 0);
    return { ...cart, lines };
  }

  private save(cart: Cart): Cart {
    const next = { ...cart, updatedAt: new Date().toISOString() };
    writeStorage(storageKeys.cart, next);
    return next;
  }

  async getCart(): Promise<Cart> {
    return delay(this.save(this.load()), 0);
  }

  async addItem(input: { productId: string; colourId: string; size: string; quantity: number }): Promise<Cart> {
    const { product, variant } = findVariant(input.productId, input.colourId, input.size);
    if (!product || !variant) throw new ServiceError('variant-not-found', 'Select a colour and size before adding to your bag.');
    if (!Number.isInteger(input.quantity) || input.quantity < 1) throw new ServiceError('invalid-quantity', 'Choose a quantity of at least 1.');
    if (variant.stock === 0) throw new ServiceError('out-of-stock', `UK ${input.size} is sold out in this colour.`);

    const cart = this.load();
    const existing = cart.lines.find((l) => l.sku === variant.sku);
    const max = Math.min(variant.stock, MAX_PER_LINE);
    const desired = (existing?.quantity ?? 0) + input.quantity;
    if (desired > max) {
      const left = max - (existing?.quantity ?? 0);
      throw new ServiceError(
        'insufficient-stock',
        left > 0
          ? `Only ${left} more available in this size. You already have ${existing?.quantity ?? 0} in your bag.`
          : `You already have the maximum available (${max}) in your bag.`,
      );
    }

    const colour = product.colours.find((c) => c.id === input.colourId);
    if (existing) {
      existing.quantity = desired;
      existing.maxQuantity = max;
    } else {
      cart.lines.push({
        id: variant.sku,
        sku: variant.sku,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        colourId: input.colourId,
        colourName: colour?.name ?? input.colourId,
        size: input.size,
        image: colour?.images[0] ?? '',
        unitPrice: product.price,
        originalUnitPrice: product.originalPrice,
        quantity: input.quantity,
        maxQuantity: max,
      });
    }
    return delay(this.save(cart), 150);
  }

  async updateQuantity(lineId: string, quantity: number): Promise<Cart> {
    const cart = this.load();
    const line = cart.lines.find((l) => l.id === lineId);
    if (!line) throw new ServiceError('line-not-found', 'That item is no longer in your bag.');
    if (!Number.isInteger(quantity) || quantity < 1) throw new ServiceError('invalid-quantity', 'Quantity must be at least 1. Use Remove to take it out of your bag.');
    if (quantity > line.maxQuantity) throw new ServiceError('insufficient-stock', `Only ${line.maxQuantity} available in this size.`);
    line.quantity = quantity;
    return delay(this.save(cart), 80);
  }

  async removeItem(lineId: string): Promise<Cart> {
    const cart = this.load();
    cart.lines = cart.lines.filter((l) => l.id !== lineId);
    return delay(this.save(cart), 80);
  }

  async applyDiscount(code: string): Promise<Cart> {
    const cart = this.load();
    if (!code.trim()) throw new ServiceError('empty-code', 'Enter a discount code.');
    const subtotal = cart.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const error = validateDiscountCode(code, subtotal);
    if (error) throw new ServiceError('invalid-code', error);
    cart.discountCode = findDiscountCode(code)?.code;
    return delay(this.save(cart), 150);
  }

  async removeDiscount(): Promise<Cart> {
    const cart = this.load();
    delete cart.discountCode;
    return delay(this.save(cart), 60);
  }

  async clear(): Promise<Cart> {
    return delay(this.save(emptyCart()), 0);
  }
}

export class MockWishlistService implements IWishlistService {
  private load(): string[] {
    return readStorage<string[]>(storageKeys.wishlist, []);
  }

  async getProductIds(): Promise<string[]> {
    return delay(this.load(), 0);
  }

  async add(productId: string): Promise<string[]> {
    const ids = this.load();
    const next = ids.includes(productId) ? ids : [productId, ...ids];
    writeStorage(storageKeys.wishlist, next);
    return delay(next, 0);
  }

  async remove(productId: string): Promise<string[]> {
    const next = this.load().filter((id) => id !== productId);
    writeStorage(storageKeys.wishlist, next);
    return delay(next, 0);
  }
}
