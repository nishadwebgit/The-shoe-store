import type { HostedCheckout, PaymentOptions } from '../../types';
import { ServiceError, type IPaymentService } from '../interfaces';

/** Mock mode has no payment gateway: only simulated (demo) payments are offered. */
export class MockPaymentService implements IPaymentService {
  getOptions(): Promise<PaymentOptions> {
    return Promise.resolve({ cardPaymentsEnabled: false, simulatedPaymentsEnabled: true, sandbox: true });
  }

  startPayHereCheckout(): Promise<HostedCheckout> {
    return Promise.reject(new ServiceError('payments_unavailable', 'Card payments need the Nishoes API. This demo build only supports demo orders.'));
  }
}
