import { useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { orderStatusLabels, paymentLabels, transactionLabels } from './api';
import type { StockState } from './types';

/* Small building blocks shared by the Owner Portal pages. */

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="ap-header">
      <div>
        <h1 className="ap-header__title">{title}</h1>
        {description && <p className="ap-header__desc">{description}</p>}
      </div>
      {actions && <div className="ap-header__actions">{actions}</div>}
    </header>
  );
}

export function Panel({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`ap-panel ${className}`}>
      {(title || actions) && (
        <header className="ap-panel__head">
          {title && <h2 className="ap-panel__title">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'warn' | 'danger' | 'good';
  icon?: ReactNode;
}) {
  return (
    <div className={`ap-stat ap-stat--${tone}`}>
      <div className="ap-stat__top">
        <span className="ap-stat__label">{label}</span>
        {icon && <span className="ap-stat__icon" aria-hidden="true">{icon}</span>}
      </div>
      <strong className="ap-stat__value">{value}</strong>
      {hint && <span className="ap-stat__hint">{hint}</span>}
    </div>
  );
}

type Tone = 'neutral' | 'info' | 'good' | 'warn' | 'danger' | 'accent';

export function Pill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`ap-pill ap-pill--${tone}`}>{children}</span>;
}

const orderTones: Record<string, Tone> = {
  pending: 'warn',
  confirmed: 'info',
  processing: 'info',
  'ready-for-dispatch': 'accent',
  shipped: 'info',
  delivered: 'good',
  cancelled: 'danger',
};

export function OrderStatusPill({ status }: { status: string }) {
  return <Pill tone={orderTones[status] ?? 'neutral'}>{orderStatusLabels[status as keyof typeof orderStatusLabels] ?? status}</Pill>;
}

const paymentTones: Record<string, Tone> = { paid: 'good', simulated: 'neutral', pending: 'warn', failed: 'danger', refunded: 'danger' };

/** Payment status. For a cancelled order an outstanding payment is shown as "Not paid" rather than "Awaiting payment". */
export function PaymentPill({ status, orderStatus }: { status: string; orderStatus?: string }) {
  if (orderStatus === 'cancelled' && (status === 'pending' || status === 'failed')) return <Pill tone="neutral">Not paid</Pill>;
  return <Pill tone={paymentTones[status] ?? 'neutral'}>{paymentLabels[status] ?? status}</Pill>;
}

export function StockPill({ state, quantity }: { state: StockState; quantity?: number }) {
  const label = state === 'out' ? 'Out of stock' : state === 'low' ? 'Low stock' : 'In stock';
  return (
    <Pill tone={state === 'out' ? 'danger' : state === 'low' ? 'warn' : 'good'}>
      {quantity !== undefined ? `${quantity} · ${label}` : label}
    </Pill>
  );
}

const transactionTones: Record<string, Tone> = {
  received: 'good',
  sale: 'info',
  released: 'neutral',
  correction: 'accent',
  damaged: 'danger',
  lost: 'danger',
  returned: 'good',
};

export function TransactionPill({ type }: { type: string }) {
  return <Pill tone={transactionTones[type] ?? 'neutral'}>{transactionLabels[type] ?? type}</Pill>;
}

export function Change({ value }: { value: number }) {
  return <span className={`ap-change ${value > 0 ? 'ap-change--up' : 'ap-change--down'}`}>{value > 0 ? `+${value}` : value}</span>;
}

/** Search box that updates its value as you type and reports it after a short pause. */
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setText(value);
  }
  useEffect(() => {
    if (text === value) return;
    const timer = window.setTimeout(() => onChange(text), 350);
    return () => window.clearTimeout(timer);
  }, [text, value, onChange]);
  return (
    <label className="ap-search">
      <Search size={18} aria-hidden="true" />
      <span className="visually-hidden">{placeholder}</span>
      <input type="search" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
    </label>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="ap-filter">
      <span className="visually-hidden">{label}</span>
      <select className="input input--compact" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Pagination({ page, totalPages, totalCount, onPage }: { page: number; totalPages: number; totalCount: number; onPage: (page: number) => void }) {
  if (totalCount === 0) return null;
  return (
    <nav className="ap-pagination" aria-label="Pagination">
      <span className="muted">
        {totalCount.toLocaleString()} result{totalCount === 1 ? '' : 's'} · page {page} of {totalPages}
      </span>
      <div className="ap-pagination__buttons">
        <button type="button" className="icon-button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={20} />
        </button>
        <button type="button" className="icon-button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight size={20} />
        </button>
      </div>
    </nav>
  );
}

/** Table wrapper: horizontal scroll on small screens, loading and empty states. */
export function DataTable({
  children,
  loading,
  empty,
  isEmpty,
  colSpan,
}: {
  children: ReactNode;
  loading?: boolean;
  empty?: ReactNode;
  isEmpty?: boolean;
  colSpan?: number;
}) {
  return (
    <div className={`ap-table-wrap${loading ? ' is-loading' : ''}`}>
      <table className="ap-table">
        {children}
        {isEmpty && !loading && (
          <tbody>
            <tr>
              <td colSpan={colSpan ?? 8} className="ap-table__empty">
                {empty ?? 'Nothing to show.'}
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'primary',
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="ap-dialog-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone === 'danger' ? 'primary' : 'accent'} className={tone === 'danger' ? 'btn--danger' : ''} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children}
    </Dialog>
  );
}

/** Simple bar chart (no chart library): one bar per day, value labels on hover. */
export function BarChart({ data, format }: { data: { label: string; value: number; title: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="ap-chart" role="img" aria-label={data.map((d) => d.title).join('; ')}>
      <div className="ap-chart__bars">
        {data.map((d) => (
          <div key={d.label} className="ap-chart__col" title={d.title}>
            <span className="ap-chart__value">{d.value > 0 ? format(d.value) : ''}</span>
            <div className="ap-chart__bar" style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="ap-chart__labels" aria-hidden="true">
        {data.map((d) => (
          <span key={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return src ? <img className="ap-thumb" src={src} alt={alt} loading="lazy" /> : <span className="ap-thumb ap-thumb--empty" aria-hidden="true" />;
}
