import { ServiceError } from '../services/interfaces';

export function errorMessage(error: unknown): string {
  if (error instanceof ServiceError) return error.message;
  return 'Something went wrong on our side. Try again in a moment.';
}
