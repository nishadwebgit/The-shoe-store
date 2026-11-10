import type { HostedCheckout } from '../types';

/**
 * Sends the browser to the gateway's hosted checkout page by posting the signed fields.
 * Card details are entered on the gateway's page, never in this storefront.
 */
export function submitHostedCheckout(checkout: HostedCheckout): void {
  const url = new URL(checkout.actionUrl);
  if (url.protocol !== 'https:') throw new Error('Refusing to send payment details over an insecure connection.');
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url.toString();
  form.style.display = 'none';
  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
