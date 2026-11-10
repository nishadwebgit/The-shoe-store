import { appConfig, deliveryMethods, discountCodes } from '../config/appConfig';
import type { CartLine, CartTotals, DeliveryMethod, DeliveryMethodId, DiscountCode } from '../types';

export function findDiscountCode(code: string | undefined): DiscountCode | undefined {
  if (!code) return undefined;
  return discountCodes.find((d) => d.code === code.trim().toUpperCase());
}

export function getDeliveryMethod(id: DeliveryMethodId): DeliveryMethod {
  return deliveryMethods.find((m) => m.id === id) ?? deliveryMethods[0];
}

/** Returns an error message if a code can't be applied to the given subtotal. */
export function validateDiscountCode(code: string, subtotal: number): string | undefined {
  const found = findDiscountCode(code);
  if (!found) return `"${code.trim().toUpperCase()}" isn't a valid code. Check the spelling and try again.`;
  if (found.minSubtotal && subtotal < found.minSubtotal) {
    return `${found.code} applies to orders over LKR ${found.minSubtotal.toLocaleString('en-LK')}.`;
  }
  return undefined;
}

export function calculateShipping(
  subtotalAfterDiscount: number,
  method: DeliveryMethod,
  discount?: DiscountCode,
): number {
  if (method.baseFee === 0) return 0;
  if (discount?.type === 'free-shipping' && method.id === 'standard') return 0;
  if (method.freeOverThreshold && subtotalAfterDiscount >= appConfig.shipping.freeShippingThreshold) return 0;
  return method.baseFee;
}

/**
 * Single source of truth for cart maths. Amounts are whole rupees so there is no
 * floating-point drift; percentage discounts are rounded to the nearest rupee.
 */
export function calculateTotals(
  lines: CartLine[],
  discountCode?: string,
  deliveryMethodId: DeliveryMethodId = 'standard',
): CartTotals {
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const saleSavings = lines.reduce(
    (sum, l) => sum + (l.originalUnitPrice ? (l.originalUnitPrice - l.unitPrice) * l.quantity : 0),
    0,
  );

  let discount = 0;
  let applied: DiscountCode | undefined;
  let discountError: string | undefined;

  if (discountCode && lines.length > 0) {
    discountError = validateDiscountCode(discountCode, subtotal);
    if (!discountError) {
      applied = findDiscountCode(discountCode);
      if (applied?.type === 'percent') discount = Math.round((subtotal * applied.value) / 100);
      if (applied?.type === 'fixed') discount = Math.min(applied.value, subtotal);
    }
  }

  const afterDiscount = subtotal - discount;
  const method = getDeliveryMethod(deliveryMethodId);
  const shipping = lines.length === 0 ? 0 : calculateShipping(afterDiscount, method, applied);
  const threshold = appConfig.shipping.freeShippingThreshold;

  return {
    itemCount,
    subtotal,
    saleSavings,
    discount,
    discountCode: applied,
    discountError,
    shipping,
    total: afterDiscount + shipping,
    amountToFreeShipping: applied?.type === 'free-shipping' ? 0 : Math.max(0, threshold - afterDiscount),
  };
}

/** Adds business days (Mon–Sat are working days for Sri Lankan couriers). */
export function addBusinessDays(from: Date, days: number): Date {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) added += 1;
  }
  return date;
}

export function estimateDelivery(methodId: DeliveryMethodId, from = new Date()): { from: string; to: string } {
  const method = getDeliveryMethod(methodId);
  return {
    from: addBusinessDays(from, method.minBusinessDays).toISOString(),
    to: addBusinessDays(from, method.maxBusinessDays).toISOString(),
  };
}
