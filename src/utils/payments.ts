import type { Order } from '../types';

/** True when the order is waiting for (or can retry) a card payment. */
export function needsPayment(order: Order): boolean {
  const awaitingFulfilment = order.status === 'pending' || order.status === 'confirmed' || order.status === 'processing';
  return awaitingFulfilment && (order.paymentStatus === 'pending' || order.paymentStatus === 'failed');
}
