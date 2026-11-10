import { appConfig } from '../../config/appConfig';
import { readStorage, removeStorage, storageKeys, writeStorage } from '../../utils/storage';
import { ServiceError } from '../interfaces';

/**
 * Central fetch client for the Nishoes ASP.NET Core Web API.
 *
 * - Base URL comes from VITE_API_BASE_URL (default "/api/v1", proxied to the API by Vite in development).
 * - The JWT access token is kept in memory only (never in localStorage). It is short-lived; when a
 *   request returns 401 the client refreshes it once using the HttpOnly refresh-token cookie and retries.
 * - Guests get an anonymous cart token from the API, stored locally and sent as the X-Cart-Token header.
 * - Errors arrive as RFC 7807 ProblemDetails and are turned into ServiceError with a shopper-safe message.
 */

const CART_TOKEN_HEADER = 'X-Cart-Token';

// ---------------------------------------------------------------- Access token (memory only)

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
type SessionListener = (signedIn: boolean) => void;
const sessionListeners = new Set<SessionListener>();

export const tokenStore = {
  get: () => accessToken,
  set(token: string | null) {
    const wasSignedIn = accessToken !== null;
    accessToken = token;
    if (wasSignedIn !== (token !== null)) sessionListeners.forEach((l) => l(token !== null));
  },
  /** Notified when the session starts or ends (including when a refresh fails). */
  subscribe(listener: SessionListener) {
    sessionListeners.add(listener);
    return () => {
      sessionListeners.delete(listener);
    };
  },
};

// ---------------------------------------------------------------- Guest cart token

export const cartTokenStore = {
  get: () => readStorage<string | null>(storageKeys.cartToken, null),
  set: (token: string | null | undefined) => (token ? writeStorage(storageKeys.cartToken, token) : removeStorage(storageKeys.cartToken)),
};

// ---------------------------------------------------------------- Errors

interface ProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
  code?: string;
  errors?: Record<string, string[]>;
}

async function toServiceError(response: Response): Promise<ServiceError> {
  let problem: ProblemDetails = {};
  try {
    problem = (await response.json()) as ProblemDetails;
  } catch {
    // Body was empty or not JSON.
  }
  const firstValidationMessage = problem.errors ? Object.values(problem.errors).flat()[0] : undefined;
  const fallback =
    response.status === 401
      ? 'Your session has ended. Sign in again to continue.'
      : response.status === 403
        ? 'You don’t have access to that.'
        : response.status === 404
          ? 'We couldn’t find what you were looking for.'
          : response.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : 'Something went wrong on our side. Try again in a moment.';
  const message = firstValidationMessage ?? (response.status >= 500 ? fallback : problem.detail ?? fallback);
  return new ServiceError(problem.code ?? `http-${response.status}`, message);
}

// ---------------------------------------------------------------- Requests

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Send the guest cart token header (cart, checkout and order look-ups). */
  withCartToken?: boolean;
  /** Skip the automatic refresh-and-retry on 401 (used by the auth endpoints themselves). */
  skipAuthRefresh?: boolean;
}

function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (options.withCartToken && !accessToken) {
    const cartToken = cartTokenStore.get();
    if (cartToken) headers.set(CART_TOKEN_HEADER, cartToken);
  }
  return headers;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const { body, withCartToken: _w, skipAuthRefresh: _s, ...init } = options;
  try {
    return await fetch(`${appConfig.apiBaseUrl}${path}`, {
      ...init,
      headers: buildHeaders(options),
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
  } catch {
    throw new ServiceError('network', 'We couldn’t reach the store. Check your connection and that the API is running, then try again.');
  }
}

/** The most recent auth payload from a refresh (lets the auth service read the customer without another call). */
export let lastAuthResponse: unknown = null;

/** Uses the refresh-token cookie to get a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${appConfig.apiBaseUrl}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } });
      if (!response.ok) {
        tokenStore.set(null);
        return false;
      }
      const data = (await response.json()) as { accessToken: string };
      tokenStore.set(data.accessToken);
      lastAuthResponse = data;
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401 && !options.skipAuthRefresh && accessToken) {
    const refreshed = await refreshSession();
    if (refreshed) response = await send(path, options);
  }

  if (!response.ok) throw await toServiceError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Like apiRequest, but resolves to undefined for 404 instead of throwing. */
export async function apiRequestOrNull<T>(path: string, options: RequestOptions = {}): Promise<T | undefined> {
  try {
    return await apiRequest<T>(path, options);
  } catch (error) {
    if (error instanceof ServiceError && (error.code === 'http-404' || error.code === 'not_found')) return undefined;
    throw error;
  }
}

export function toQueryString(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false || (Array.isArray(value) && value.length === 0)) continue;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}
