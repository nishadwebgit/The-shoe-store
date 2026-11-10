import type { DeliveryMethod, DiscountCode } from '../types';

/**
 * Application configuration. Environment-specific values come from Vite env variables
 * (see `.env.example`). Business rules used by the mock services live here so they can be
 * moved server-side when the ASP.NET Core API takes over.
 */
export const appConfig = {
  /**
   * Base URL of the Nishoes ASP.NET Core Web API. The default "/api/v1" is proxied by Vite to the API
   * in development (see vite.config.ts). For a deployed API use a full URL, e.g. https://api.example.com/api/v1.
   */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, ''),
  /**
   * true = local mock data and localStorage only (no network); anything else = the ASP.NET Core API.
   * Compared as a literal so Vite can resolve it at build time and drop the unused implementation.
   */
  useMockServices: import.meta.env.VITE_USE_MOCK_SERVICES === 'true',
  /** Artificial latency for mock services so loading states are visible. */
  mockLatencyMs: 220,

  currency: {
    code: 'LKR',
    locale: 'en-LK',
  },

  pageSize: 12,

  shipping: {
    freeShippingThreshold: 25000,
  },
} as const;

export const deliveryMethods: DeliveryMethod[] = [
  {
    id: 'standard',
    label: 'Standard delivery',
    description: 'Island-wide courier',
    minBusinessDays: 3,
    maxBusinessDays: 5,
    baseFee: 450,
    freeOverThreshold: true,
  },
  {
    id: 'express',
    label: 'Express delivery',
    description: 'Colombo, Gampaha and Kalutara districts',
    minBusinessDays: 1,
    maxBusinessDays: 2,
    baseFee: 1200,
    freeOverThreshold: false,
  },
  {
    id: 'pickup',
    label: 'Collect from the Ward Place store',
    description: 'Ready the next business day',
    minBusinessDays: 1,
    maxBusinessDays: 1,
    baseFee: 0,
    freeOverThreshold: false,
  },
];

/** Sample discount codes for the demo. */
export const discountCodes: DiscountCode[] = [
  { code: 'NISHOES10', description: '10% off your order', type: 'percent', value: 10 },
  {
    code: 'WELCOME1500',
    description: 'LKR 1,500 off orders over LKR 15,000',
    type: 'fixed',
    value: 1500,
    minSubtotal: 15000,
  },
  { code: 'FREESHIP', description: 'Free standard delivery', type: 'free-shipping', value: 0 },
];
