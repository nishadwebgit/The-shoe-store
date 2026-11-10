import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "drawer-right", "drawer-left" or centred "modal". */
  variant?: 'drawer-right' | 'drawer-left' | 'modal';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Accessible dialog built on the native <dialog> element: it provides focus trapping,
 * Escape to close, inert background and returns focus to the trigger on close.
 */
export function Dialog({ open, onClose, title, children, footer, variant = 'modal', size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.classList.add('scroll-locked');
    } else if (!open && dialog.open) {
      dialog.close();
    }
    if (!open) document.documentElement.classList.remove('scroll-locked');
  }, [open]);

  useEffect(() => () => document.documentElement.classList.remove('scroll-locked'), []);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${variant} dialog--${size}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself) closes it.
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog__panel">
          <header className="dialog__header">
            <h2 id={titleId} className="dialog__title">
              {title}
            </h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              <X size={22} />
            </button>
          </header>
          <div className="dialog__body">{children}</div>
          {footer && <footer className="dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
