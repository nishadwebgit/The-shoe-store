import { products } from '../../data/products';
import type { CreateOrderRequest, Order, OrderLine } from '../../types';
import { calculateTotals, estimateDelivery } from '../../utils/pricing';
import { createId, createOrderNumber } from '../../utils/random';
import { readStorage, storageKeys, writeStorage } from '../../utils/storage';
import { ServiceError, type IEngagementService, type IOrderService } from '../interfaces';
import { DEMO_CUSTOMER, loadCustomers } from './MockAuthService';
import { delay, findSku, recordSale } from './mockInfrastructure';

function line(productId: string, colourIndex: number, size: string, quantity: number): OrderLine {
  const p = products.find((x) => x.id === productId)!;
  const colour = p.colours[colourIndex];
  return {
    sku: `${p.id}-${colour.id.toUpperCase()}-${size}`,
    productId: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    colourName: colour.name,
    size,
    image: colour.images[0],
    unitPrice: p.price,
    quantity,
  };
}

/** Sample order history for the demo account. */
function seedOrders(): Order[] {
  const a = [line('P012', 0, '6', 1), line('P031', 1, '6', 1)];
  const b = [line('P001', 0, '8', 1)];
  const c = [line('P018', 0, '12K', 2)];
  const make = (num: string, placedAt: string, status: Order['status'], lines: OrderLine[], code?: string): Order => {
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const discount = code === 'NISHOES10' ? Math.round(subtotal * 0.1) : 0;
    const shipping = subtotal - discount >= 25000 ? 0 : 450;
    const est = estimateDelivery('standard', new Date(placedAt));
    return {
      id: `ord_seed_${num}`,
      orderNumber: num,
      customerId: DEMO_CUSTOMER.id,
      email: DEMO_CUSTOMER.email,
      placedAt,
      status,
      lines,
      shippingAddress: DEMO_CUSTOMER.defaultAddress!,
      deliveryMethod: 'standard',
      estimatedDelivery: est,
      subtotal,
      discount,
      discountCode: code,
      shipping,
      total: subtotal - discount + shipping,
      paymentMethod: 'demo',
      paymentStatus: 'simulated',
      paymentProvider: 'Simulated',
    };
  };
  return [
    make('NS-2610-58213', '2026-10-28T10:15:00.000Z', 'shipped', a, 'NISHOES10'),
    make('NS-2608-30477', '2026-08-03T14:40:00.000Z', 'delivered', b),
    make('NS-2605-11902', '2026-05-19T08:05:00.000Z', 'delivered', c),
  ];
}

function loadOrders(): Order[] {
  const stored = readStorage<Order[] | null>(storageKeys.orders, null);
  if (stored) return stored;
  const seeded = seedOrders();
  writeStorage(storageKeys.orders, seeded);
  return seeded;
}

export class MockOrderService implements IOrderService {
  async createOrder(request: CreateOrderRequest): Promise<Order> {
    if (request.lines.length === 0) throw new ServiceError('empty-cart', 'Your bag is empty. Add a pair before checking out.');

    // Server-side style re-validation: stock and prices are re-checked, never trusted from the client.
    const lines: OrderLine[] = request.lines.map((l) => {
      const { product, variant } = findSku(l.sku);
      if (!product || !variant) throw new ServiceError('variant-not-found', `${l.name} is no longer available.`);
      if (variant.stock < l.quantity) {
        throw new ServiceError(
          'insufficient-stock',
          `${product.name} (UK ${l.size}) now has only ${variant.stock} left. Update your bag and try again.`,
        );
      }
      return {
        sku: l.sku, productId: product.id, slug: product.slug, name: product.name, brand: product.brand,
        colourName: l.colourName, size: l.size, image: l.image, unitPrice: product.price, quantity: l.quantity,
      };
    });

    const totals = calculateTotals(request.lines, request.discountCode, request.deliveryMethod);
    const now = new Date();
    const order: Order = {
      id: createId('ord'),
      orderNumber: createOrderNumber(now),
      customerId: request.customerId,
      email: request.email.trim().toLowerCase(),
      placedAt: now.toISOString(),
      status: 'pending',
      lines,
      shippingAddress: request.shippingAddress,
      deliveryMethod: request.deliveryMethod,
      estimatedDelivery: estimateDelivery(request.deliveryMethod, now),
      subtotal: totals.subtotal,
      discount: totals.discount,
      discountCode: totals.discountCode?.code,
      shipping: totals.shipping,
      total: totals.total,
      paymentMethod: 'demo',
      paymentStatus: 'simulated',
      paymentProvider: 'Simulated',
    };

    writeStorage(storageKeys.orders, [order, ...loadOrders()]);
    recordSale(lines);
    // Like the API: the purchased bag is emptied and, if asked, the address becomes the default.
    writeStorage(storageKeys.cart, { lines: [], updatedAt: now.toISOString() });
    if (request.saveAddress && request.customerId) {
      const customers = loadCustomers();
      writeStorage(
        storageKeys.customers,
        customers.map((c) => (c.id === request.customerId ? { ...c, defaultAddress: request.shippingAddress } : c)),
      );
    }
    return delay(order, 700);
  }

  async getOrdersForCustomer(customerId: string): Promise<Order[]> {
    return delay(
      loadOrders()
        .filter((o) => o.customerId === customerId)
        .sort((a, b) => b.placedAt.localeCompare(a.placedAt)),
    );
  }

  async getOrder(orderNumber: string): Promise<Order | undefined> {
    return delay(loadOrders().find((o) => o.orderNumber === orderNumber));
  }
}

export class MockEngagementService implements IEngagementService {
  async subscribe(email: string): Promise<void> {
    const list = readStorage<string[]>(storageKeys.newsletter, []);
    const normalised = email.trim().toLowerCase();
    if (list.includes(normalised)) throw new ServiceError('already-subscribed', 'This email is already on the list.');
    writeStorage(storageKeys.newsletter, [...list, normalised]);
    return delay(undefined, 300);
  }

  async sendContactMessage(): Promise<{ reference: string }> {
    return delay({ reference: `CS-${Math.floor(100000 + Math.random() * 899999)}` }, 500);
  }
}
