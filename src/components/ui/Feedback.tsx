import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon">{icon}</div>}
      <h2 className="empty-state__title">{title}</h2>
      {children && <div className="empty-state__body">{children}</div>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert--error" role="alert">
      <AlertTriangle size={20} aria-hidden="true" />
      <div>
        <p>{message}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry} className="alert__action">
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

export function Badge({ tone = 'ink', children }: { tone?: 'ink' | 'saffron' | 'sale' | 'muted'; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
