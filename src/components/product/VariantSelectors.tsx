import { Ruler } from 'lucide-react';
import type { Product } from '../../types';
import { colourInStock, sizeStock } from '../../features/catalogue/productHelpers';
import { sizedImage } from '../../utils/images';

export function ColourSelector({
  product,
  value,
  onChange,
}: {
  product: Product;
  value: string;
  onChange: (colourId: string) => void;
}) {
  const selected = product.colours.find((c) => c.id === value);
  return (
    <fieldset className="selector">
      <legend className="selector__legend">
        Colour: <span className="selector__value">{selected?.name}</span>
      </legend>
      <div className="colour-options">
        {product.colours.map((c) => {
          const available = colourInStock(product, c.id);
          return (
            <label key={c.id} className={`colour-option${available ? '' : ' is-unavailable'}`} title={c.name}>
              <input type="radio" name={`colour-${product.id}`} value={c.id} checked={c.id === value} onChange={() => onChange(c.id)} />
              <img src={sizedImage(c.images[0], 160)} alt="" loading="lazy" />
              <span className="visually-hidden">
                {c.name}
                {available ? '' : ' (sold out)'}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SizeSelector({
  product,
  colourId,
  value,
  onChange,
  error,
  onOpenGuide,
  preferredSize,
}: {
  product: Product;
  colourId: string;
  value: string | null;
  onChange: (size: string) => void;
  error?: string;
  onOpenGuide?: () => void;
  preferredSize?: string | null;
}) {
  const stock = sizeStock(product, colourId);
  const fitNote =
    product.fit === 'small' ? 'Runs small. We suggest half a size up.' : product.fit === 'large' ? 'Runs large. We suggest half a size down.' : 'True to size.';
  return (
    <fieldset className={`selector${error ? ' selector--invalid' : ''}`} aria-describedby={error ? `size-error-${product.id}` : undefined}>
      <legend className="selector__legend">
        Size (UK{product.sizeSystem === 'kids' ? ', kids' : ''})
        {value && <span className="selector__value">: {value.replace('K', '')}</span>}
      </legend>
      {onOpenGuide && (
        <button type="button" className="text-link text-link--icon selector__guide" onClick={onOpenGuide}>
          <Ruler size={16} aria-hidden="true" /> Size guide
        </button>
      )}
      <p className="selector__hint">{fitNote}</p>
      <div className="size-grid">
        {product.sizes.map((size) => {
          const qty = stock[size] ?? 0;
          const unavailable = qty === 0;
          return (
            <label
              key={size}
              className={`size-option${unavailable ? ' is-unavailable' : ''}${size === preferredSize ? ' is-preferred' : ''}`}
            >
              <input
                type="radio"
                name={`size-${product.id}`}
                value={size}
                checked={size === value}
                disabled={unavailable}
                onChange={() => onChange(size)}
              />
              <span className="size-option__label">{size.replace('K', '')}</span>
              {unavailable && <span className="visually-hidden"> (sold out)</span>}
              {!unavailable && qty <= 3 && <span className="size-option__low" aria-label={`only ${qty} left`} />}
            </label>
          );
        })}
      </div>
      {error && (
        <p className="field__error" id={`size-error-${product.id}`} role="alert">
          {error}
        </p>
      )}
      <p className="selector__legend-key muted">
        <span className="size-key size-key--low" aria-hidden="true" /> Only a few left
        <span className="size-key size-key--out" aria-hidden="true" /> Sold out
      </p>
    </fieldset>
  );
}
