/**
 * Centralised validation rules. Each validator returns an error message or `undefined`.
 * Keep messages actionable: say what is wrong and how to fix it.
 */
export type Validator = (value: string) => string | undefined;

export const required =
  (label: string): Validator =>
  (value) =>
    value.trim() ? undefined : `Enter your ${label}.`;

export const email: Validator = (value) => {
  if (!value.trim()) return 'Enter your email address.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
    ? undefined
    : 'Enter an email address in the format name@example.com.';
};

/** Sri Lankan phone numbers: 0XX XXX XXXX or +94 XX XXX XXXX. */
export const phone: Validator = (value) => {
  const digits = value.replace(/[\s-]/g, '');
  if (!digits) return 'Enter a phone number so the courier can reach you.';
  return /^(?:\+94|0)\d{9}$/.test(digits) ? undefined : 'Enter a Sri Lankan number, e.g. 077 123 4567.';
};

export const postalCode: Validator = (value) => {
  if (!value.trim()) return 'Enter your postal code.';
  return /^\d{5}$/.test(value.trim()) ? undefined : 'Postal codes in Sri Lanka have 5 digits, e.g. 00700.';
};

export const password: Validator = (value) => {
  if (!value) return 'Enter a password.';
  if (value.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Include at least one letter and one number.';
  return undefined;
};

export const minLength =
  (label: string, min: number): Validator =>
  (value) => {
    if (!value.trim()) return `Enter your ${label}.`;
    return value.trim().length >= min ? undefined : `Your ${label} needs at least ${min} characters.`;
  };

export type Schema<T extends string> = Record<T, Validator[]>;

export function validate<T extends string>(
  values: Record<T, string>,
  schema: Partial<Schema<T>>,
): Partial<Record<T, string>> {
  const errors: Partial<Record<T, string>> = {};
  for (const key of Object.keys(schema) as T[]) {
    for (const rule of schema[key] ?? []) {
      const message = rule(values[key] ?? '');
      if (message) {
        errors[key] = message;
        break;
      }
    }
  }
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
