import { useState, type FormEvent } from 'react';
import { brand } from '../../config/brand';
import { services } from '../../services';
import { errorMessage } from '../../utils/errors';
import { email as emailRule } from '../../utils/validation';
import { Button } from '../ui/Button';

export function Newsletter() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = emailRule(value);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await services.engagement.subscribe(value);
      setDone(true);
      setError(undefined);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="newsletter" aria-labelledby="newsletter-title">
      <div className="newsletter__copy">
        <h2 id="newsletter-title" className="newsletter__title">
          First dibs on new drops
        </h2>
        <p>Restock alerts, early access to sales and running club dates in Colombo. One email a fortnight.</p>
      </div>
      {done ? (
        <p className="newsletter__done" role="status">
          You’re on the list. Look out for an email from {brand.email} within two weeks.
        </p>
      ) : (
        <form className="newsletter__form" onSubmit={submit} noValidate>
          <label htmlFor="newsletter-email" className="visually-hidden">
            Email address
          </label>
          <input
            id="newsletter-email"
            className="input"
            type="email"
            placeholder="you@example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'newsletter-error' : 'newsletter-note'}
            autoComplete="email"
          />
          <Button type="submit" variant="accent" loading={busy}>
            Subscribe
          </Button>
          {error ? (
            <p id="newsletter-error" className="field__error newsletter__msg">
              {error}
            </p>
          ) : (
            <p id="newsletter-note" className="newsletter__msg">
              Unsubscribe any time. We never share your email.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
