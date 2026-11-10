import { useState, type FormEvent } from 'react';
import { Info } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ErrorState } from '../../components/ui/Feedback';
import { Checkbox, TextField } from '../../components/ui/FormField';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAuth, useToast } from '../../hooks/useStore';
import { errorMessage } from '../../utils/errors';
import { email, hasErrors, password, required, validate } from '../../utils/validation';

function safeRedirect(value: string | null): string {
  // Only allow in-app paths to avoid open redirects.
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/account';
}

function DemoNotice() {
  if (import.meta.env.VITE_USE_MOCK_SERVICES !== 'true') {
    return (
      <div className="demo-notice">
        <Info size={18} aria-hidden="true" />
        <p>
          Your account is stored securely by the Nishoes API. Passwords are hashed and never stored in your browser.
        </p>
      </div>
    );
  }
  return (
    <div className="demo-notice">
      <Info size={18} aria-hidden="true" />
      <p>
        <strong>Demo sign-in.</strong> Accounts live only in this browser and passwords are never stored. Try{' '}
        <code>demo@nishoes.lk</code> with any 8+ character password.
      </p>
    </div>
  );
}

export function SignInPage() {
  useDocumentTitle('Sign in');
  const { customer, signIn } = useAuth();
  const { notify } = useToast();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirect = safeRedirect(params.get('redirect'));
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<'email' | 'password', string>>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (customer && !busy) return <Navigate to={redirect} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form, { email: [email], password: [required('password')] });
    setErrors(found);
    if (hasErrors(found)) return;
    setBusy(true);
    setFailure(undefined);
    try {
      const c = await signIn(form);
      notify(`Welcome back, ${c.firstName}`);
      navigate(redirect, { replace: true });
    } catch (err) {
      setFailure(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="container auth">
      <div className="auth__card">
        <h1 className="page-title">Sign in</h1>
        <p className="muted">Track orders, save your size and check out faster.</p>
        <DemoNotice />
        {failure && <ErrorState message={failure} />}
        <form onSubmit={submit} noValidate className="auth__form">
          <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
          <TextField label="Password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} />
          <Button type="submit" size="lg" block loading={busy}>
            Sign in
          </Button>
        </form>
        <p className="auth__switch">
          New to Nishoes? <Link to={`/register${params.get('redirect') ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>Create an account</Link>
        </p>
        <p className="auth__switch muted">
          Just want to buy? <Link to="/checkout">Check out as a guest</Link>
        </p>
      </div>
    </div>
  );
}

type RegisterKeys = 'firstName' | 'lastName' | 'email' | 'password' | 'confirm';

export function RegisterPage() {
  useDocumentTitle('Create an account');
  const { customer, register } = useAuth();
  const { notify } = useToast();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirect = safeRedirect(params.get('redirect'));
  const [form, setForm] = useState<Record<RegisterKeys, string>>({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [optIn, setOptIn] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<RegisterKeys, string>>>({});
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (customer && !busy) return <Navigate to={redirect} replace />;

  const set = (k: RegisterKeys) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form, {
      firstName: [required('first name')],
      lastName: [required('last name')],
      email: [email],
      password: [password],
      confirm: [(v) => (v === form.password ? undefined : 'The passwords don’t match.')],
    });
    setErrors(found);
    if (hasErrors(found)) return;
    setBusy(true);
    setFailure(undefined);
    try {
      const c = await register({ firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password, marketingOptIn: optIn });
      notify(`Welcome to Nishoes, ${c.firstName}`);
      navigate(redirect, { replace: true });
    } catch (err) {
      setFailure(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="container auth">
      <div className="auth__card">
        <h1 className="page-title">Create an account</h1>
        <DemoNotice />
        {failure && <ErrorState message={failure} />}
        <form onSubmit={submit} noValidate className="auth__form">
          <div className="form-grid">
            <TextField label="First name" autoComplete="given-name" value={form.firstName} onChange={(e) => set('firstName')(e.target.value)} error={errors.firstName} />
            <TextField label="Last name" autoComplete="family-name" value={form.lastName} onChange={(e) => set('lastName')(e.target.value)} error={errors.lastName} />
          </div>
          <TextField label="Email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)} error={errors.email} />
          <TextField label="Password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set('password')(e.target.value)} error={errors.password} hint="At least 8 characters, with a letter and a number." />
          <TextField label="Confirm password" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => set('confirm')(e.target.value)} error={errors.confirm} />
          <Checkbox checked={optIn} onChange={(e) => setOptIn(e.target.checked)} label="Email me about new drops and restocks" />
          <Button type="submit" size="lg" block loading={busy}>
            Create account
          </Button>
        </form>
        <p className="auth__switch">
          Already have an account? <Link to="/sign-in">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
