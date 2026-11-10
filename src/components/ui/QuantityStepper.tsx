import { Minus, Plus } from 'lucide-react';

interface Props {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}

/** Quantity control that cannot produce values outside [min, max]. */
export function QuantityStepper({ value, min = 1, max, onChange, disabled, label = 'Quantity', size = 'md' }: Props) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className={`stepper stepper--${size}`} role="group" aria-label={label}>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Decrease ${label.toLowerCase()}`}
      >
        <Minus size={16} />
      </button>
      <output className="stepper__value" aria-live="polite" aria-label={`${label}: ${value}`}>
        {value}
      </output>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Increase ${label.toLowerCase()}`}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
