import {
  HttpAuthService,
  HttpCartService,
  HttpCheckoutService,
  HttpInventoryService,
  HttpOrderService,
  HttpPaymentService,
  HttpProductService,
  HttpWishlistService,
} from './http/httpServices';
import type { ServiceRegistry } from './interfaces';
import { MockAuthService } from './mock/MockAuthService';
import { MockCartService, MockWishlistService } from './mock/MockCartService';
import { MockCheckoutService } from './mock/MockCheckoutService';
import { MockEngagementService, MockOrderService } from './mock/MockOrderService';
import { MockPaymentService } from './mock/MockPaymentService';
import { MockInventoryService, MockProductService } from './mock/MockProductService';

/**
 * The single place where service implementations are chosen.
 * VITE_USE_MOCK_SERVICES=false (the default in `.env`) uses the ASP.NET Core API; set it to true
 * to run the storefront entirely on local mock data.
 */
function createServices(): ServiceRegistry {
  // Written as a build-time constant: in API builds the mock services and the local catalogue
  // are removed from the bundle entirely, so product data can only come from the API.
  if (import.meta.env.VITE_USE_MOCK_SERVICES === 'true') {
    return {
      products: new MockProductService(),
      inventory: new MockInventoryService(),
      cart: new MockCartService(),
      wishlist: new MockWishlistService(),
      auth: new MockAuthService(),
      orders: new MockOrderService(),
      checkout: new MockCheckoutService(),
      payments: new MockPaymentService(),
      engagement: new MockEngagementService(),
    };
  }
  const cart = new HttpCartService();
  const wishlist = new HttpWishlistService();
  return {
    products: new HttpProductService(),
    inventory: new HttpInventoryService(),
    cart,
    wishlist,
    auth: new HttpAuthService(cart, wishlist),
    orders: new HttpOrderService(),
    checkout: new HttpCheckoutService(),
    payments: new HttpPaymentService(),
    // Newsletter and contact forms have no backend endpoints yet, so they stay local.
    engagement: new MockEngagementService(),
  };
}

export const services: ServiceRegistry = createServices();
export { ServiceError } from './interfaces';
