import { deliveryMethods } from '../../config/appConfig';
import { expressDistricts } from '../../data/districts';
import type { CartTotals, DeliveryMethodId, ShippingOption } from '../../types';
import { calculateShipping, calculateTotals, estimateDelivery, findDiscountCode } from '../../utils/pricing';
import { readStorage, storageKeys } from '../../utils/storage';
import type { Cart } from '../../types';
import type { ICheckoutService } from '../interfaces';
import { delay } from './mockInfrastructure';

/** Local delivery options and quotes, using the same rules as the API (see utils/pricing.ts). */
export class MockCheckoutService implements ICheckoutService {
  async getShippingOptions(input: { district?: string; subtotal: number; couponCode?: string }): Promise<ShippingOption[]> {
    const coupon = findDiscountCode(input.couponCode);
    return delay(
      deliveryMethods.map((m) => ({
        id: m.id,
        label: m.label,
        description: m.description,
        fee: calculateShipping(input.subtotal, m, coupon),
        available: m.id !== 'express' || !input.district || expressDistricts.includes(input.district),
        estimatedDelivery: estimateDelivery(m.id),
      })),
      60,
    );
  }

  async quote(input: { deliveryMethod: DeliveryMethodId; couponCode?: string }): Promise<CartTotals> {
    const cart = readStorage<Cart>(storageKeys.cart, { lines: [], updatedAt: '' });
    return delay(calculateTotals(cart.lines, input.couponCode ?? cart.discountCode, input.deliveryMethod), 60);
  }
}
