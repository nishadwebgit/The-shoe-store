import type { AuthSession, Customer, RegisterRequest, SignInRequest } from '../../types';
import { createId } from '../../utils/random';
import { readStorage, removeStorage, storageKeys, writeStorage } from '../../utils/storage';
import { ServiceError, type IAuthService } from '../interfaces';
import { delay } from './mockInfrastructure';

/**
 * DEMO AUTHENTICATION — NOT SECURE.
 *
 * - Customer profiles (name, email, preferences) are kept in localStorage.
 * - Passwords are NEVER stored. Sign-in only checks that the email belongs to a registered
 *   demo profile and that a password of valid shape was entered.
 * - The "token" is a random string with no meaning.
 *
 * The ASP.NET Core API should replace this with ASP.NET Core Identity (hashed passwords),
 * JWT or cookie authentication, HTTPS-only cookies and server-side session validation.
 */

export const DEMO_CUSTOMER: Customer = {
  id: 'cus_demo',
  firstName: 'Nadeesha',
  lastName: 'Perera',
  email: 'demo@nishoes.lk',
  phone: '0771234567',
  createdAt: '2025-08-12T09:30:00.000Z',
  preferredSize: '8',
  marketingOptIn: true,
  defaultAddress: {
    firstName: 'Nadeesha',
    lastName: 'Perera',
    line1: '18 Flower Road',
    line2: 'Apartment 3B',
    city: 'Colombo 07',
    district: 'Colombo',
    postalCode: '00700',
    phone: '0771234567',
  },
};

const SESSION_HOURS = 12;

export function loadCustomers(): Customer[] {
  const stored = readStorage<Customer[]>(storageKeys.customers, []);
  return stored.some((c) => c.id === DEMO_CUSTOMER.id) ? stored : [DEMO_CUSTOMER, ...stored];
}

function saveCustomers(customers: Customer[]): void {
  writeStorage(storageKeys.customers, customers);
}

function createSession(customerId: string): AuthSession {
  const session: AuthSession = {
    customerId,
    token: `demo.${createId('tok')}`,
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000).toISOString(),
  };
  writeStorage(storageKeys.session, session);
  return session;
}

export class MockAuthService implements IAuthService {
  async register(request: RegisterRequest) {
    const customers = loadCustomers();
    const email = request.email.trim().toLowerCase();
    if (customers.some((c) => c.email === email)) {
      throw new ServiceError('email-taken', 'An account with this email already exists. Sign in instead.');
    }
    const customer: Customer = {
      id: createId('cus'),
      firstName: request.firstName.trim(),
      lastName: request.lastName.trim(),
      email,
      createdAt: new Date().toISOString(),
      marketingOptIn: request.marketingOptIn,
    };
    // request.password is intentionally discarded — never persisted.
    saveCustomers([...customers, customer]);
    return delay({ session: createSession(customer.id), customer }, 350);
  }

  async signIn(request: SignInRequest) {
    const email = request.email.trim().toLowerCase();
    const customer = loadCustomers().find((c) => c.email === email);
    if (!customer || request.password.length < 8) {
      // Generic message: never reveal which part was wrong.
      throw new ServiceError('invalid-credentials', 'The email or password is incorrect. Check them and try again.');
    }
    return delay({ session: createSession(customer.id), customer }, 350);
  }

  async signOut(): Promise<void> {
    removeStorage(storageKeys.session);
    return delay(undefined, 100);
  }

  async getCurrentCustomer(): Promise<Customer | null> {
    const session = readStorage<AuthSession | null>(storageKeys.session, null);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      removeStorage(storageKeys.session);
      return delay(null, 0);
    }
    return delay(loadCustomers().find((c) => c.id === session.customerId) ?? null, 0);
  }

  async updateProfile(changes: Partial<Omit<Customer, 'id' | 'email' | 'createdAt'>>): Promise<Customer> {
    const current = await this.getCurrentCustomer();
    if (!current) throw new ServiceError('not-signed-in', 'Your session has ended. Sign in again to update your details.');
    const updated = { ...current, ...changes };
    saveCustomers(loadCustomers().map((c) => (c.id === updated.id ? updated : c)));
    return delay(updated, 250);
  }
}
