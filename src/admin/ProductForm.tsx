import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Checkbox, SelectField, TextAreaField, TextField } from '../components/ui/FormField';
import { ImageManager, type ImageItem } from './ImageManager';
import type { AdminProduct, Lookups, ProductRequest } from './types';

interface ColourDraft {
  key: string;
  id: number | null;
  name: string;
  swatch: string;
  family: string;
  sizes: string[];
  images: ImageItem[];
  /** Sizes that hold stock and so can't be removed here. */
  stockedSizes: string[];
}

interface Draft {
  name: string;
  code: string;
  brandId: string;
  newBrandName: string;
  categories: string[];
  gender: string;
  sizeSystem: 'adult' | 'kids';
  fit: string;
  silhouette: string;
  description: string;
  materials: string;
  care: string;
  regularPrice: string;
  salePrice: string;
  isActive: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  highlights: string;
  colours: ColourDraft[];
}

type Errors = Partial<Record<string, string>>;

function fromProduct(p: AdminProduct | undefined, lookups: Lookups): Draft {
  if (!p) {
    return {
      name: '',
      code: lookups.nextProductCode,
      brandId: '',
      newBrandName: '',
      categories: [],
      gender: 'unisex',
      sizeSystem: 'adult',
      fit: 'true',
      silhouette: 'runner',
      description: '',
      materials: '',
      care: '',
      regularPrice: '',
      salePrice: '',
      isActive: true,
      isFeatured: false,
      isNewArrival: true,
      highlights: '',
      colours: [newColour(lookups)],
    };
  }
  return {
    name: p.name,
    code: p.code,
    brandId: String(p.brandId),
    newBrandName: '',
    categories: p.categories,
    gender: p.gender,
    sizeSystem: p.sizeSystem,
    fit: p.fit,
    silhouette: p.silhouette,
    description: p.description,
    materials: p.materials,
    care: p.care,
    regularPrice: String(p.regularPrice),
    salePrice: p.salePrice ? String(p.salePrice) : '',
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    highlights: p.highlights.join('\n'),
    colours: p.colours.map((c) => ({
      key: String(c.id),
      id: c.id,
      name: c.name,
      swatch: c.swatch,
      family: c.family,
      sizes: p.variants.filter((v) => v.colourId === c.id).map((v) => v.size),
      images: c.images.map((i) => ({ url: i.url, altText: i.altText })),
      stockedSizes: p.variants.filter((v) => v.colourId === c.id && v.stock > 0).map((v) => v.size),
    })),
  };
}

function newColour(lookups: Lookups): ColourDraft {
  return { key: crypto.randomUUID(), id: null, name: '', swatch: '#1b1d22', family: lookups.colourFamilies[0]?.value ?? 'black', sizes: [], images: [], stockedSizes: [] };
}

function validate(d: Draft): Errors {
  const e: Errors = {};
  if (!d.name.trim()) e.name = 'Enter the product name.';
  if ((!d.brandId || d.brandId === 'new') && !d.newBrandName.trim()) e.brand = 'Choose a brand or add a new one.';
  if (d.categories.length === 0) e.categories = 'Choose at least one category.';
  if (!d.description.trim()) e.description = 'Write a short description customers will read.';
  const regular = Number(d.regularPrice);
  if (!d.regularPrice || !(regular > 0)) e.regularPrice = 'Enter the regular price.';
  if (d.salePrice) {
    const sale = Number(d.salePrice);
    if (!(sale > 0)) e.salePrice = 'Enter a valid sale price or leave it empty.';
    else if (regular > 0 && sale >= regular) e.salePrice = 'The sale price must be lower than the regular price.';
  }
  if (d.colours.length === 0) e.colours = 'Add at least one colour.';
  d.colours.forEach((c, i) => {
    if (!c.name.trim()) e[`colour-${i}-name`] = 'Name this colour, e.g. Black / White.';
    if (c.sizes.length === 0) e[`colour-${i}-sizes`] = 'Choose the sizes you sell in this colour.';
  });
  return e;
}

function toRequest(d: Draft): ProductRequest {
  return {
    name: d.name.trim(),
    code: d.code.trim() || null,
    brandId: d.brandId && d.brandId !== 'new' ? Number(d.brandId) : null,
    newBrandName: d.brandId === 'new' || !d.brandId ? d.newBrandName.trim() || null : null,
    categories: d.categories,
    gender: d.gender,
    sizeSystem: d.sizeSystem,
    fit: d.fit,
    silhouette: d.silhouette,
    description: d.description.trim(),
    materials: d.materials.trim() || null,
    care: d.care.trim() || null,
    regularPrice: Number(d.regularPrice),
    salePrice: d.salePrice ? Number(d.salePrice) : null,
    isActive: d.isActive,
    isFeatured: d.isFeatured,
    isNewArrival: d.isNewArrival,
    highlights: d.highlights.split('\n').map((h) => h.trim()).filter(Boolean),
    colours: d.colours.map((c) => ({
      id: c.id,
      name: c.name.trim(),
      swatch: c.swatch,
      family: c.family,
      sizes: c.sizes,
      images: c.images,
    })),
  };
}

/**
 * Product details form, used by "Add new product", "Edit product" and the stock receiving wizard.
 * Stock isn't edited here: sizes are created with zero stock and filled by receiving stock.
 */
export function ProductForm({
  product,
  lookups,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  product?: AdminProduct;
  lookups: Lookups;
  submitLabel: string;
  onSubmit: (request: ProductRequest) => Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => fromProduct(product, lookups));
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const isNew = !product;
  const sizes = lookups.sizes.filter((s) => s.sizeSystem === draft.sizeSystem);
  const locked = !isNew && product.variants.length > 0;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    // Clear a field's error as soon as it's edited.
    const field = key === 'brandId' || key === 'newBrandName' ? 'brand' : (key as string);
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const setColour = (index: number, patch: Partial<ColourDraft> | ((c: ColourDraft) => Partial<ColourDraft>)) =>
    setDraft((d) => ({
      ...d,
      colours: d.colours.map((c, i) => (i === index ? { ...c, ...(typeof patch === 'function' ? patch(c) : patch) } : c)),
    }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      document.querySelector<HTMLElement>('.field--invalid input, .field--invalid textarea, .field--invalid select, .ap-error')?.focus();
      return;
    }
    setBusy(true);
    try {
      await onSubmit(toRequest(draft));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="ap-form" onSubmit={submit} noValidate>
      <section className="ap-panel">
        <h2 className="ap-panel__title">Basic details</h2>
        <div className="ap-form__grid">
          <TextField label="Product name" value={draft.name} onChange={(e) => set('name', e.target.value)} error={errors.name} maxLength={150} />
          <TextField
            label="Product code"
            value={draft.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())}
            disabled={!isNew}
            hint={isNew ? 'Used in every SKU. Leave the suggestion or type your own.' : 'Codes can’t change after creation.'}
            maxLength={20}
          />
          <SelectField
            label="Brand"
            value={draft.brandId}
            onChange={(e) => set('brandId', e.target.value)}
            error={errors.brand}
          >
            <option value="">Choose a brand</option>
            {lookups.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            <option value="new">+ Add a new brand</option>
          </SelectField>
          {draft.brandId === 'new' && (
            <TextField label="New brand name" value={draft.newBrandName} onChange={(e) => set('newBrandName', e.target.value)} maxLength={80} />
          )}
          <SelectField label="Who it’s for" value={draft.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="unisex">Unisex</option>
            <option value="kids">Kids</option>
          </SelectField>
          <SelectField
            label="Product type"
            value={draft.silhouette}
            onChange={(e) => set('silhouette', e.target.value)}
          >
            {lookups.silhouettes.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Sizing"
            value={draft.sizeSystem}
            onChange={(e) => setDraft((d) => ({ ...d, sizeSystem: e.target.value as Draft['sizeSystem'], colours: d.colours.map((c) => ({ ...c, sizes: [] })) }))}
            disabled={locked}
            hint={locked ? 'Sizing can’t change once sizes exist.' : undefined}
          >
            <option value="adult">Adult UK sizes</option>
            <option value="kids">Kids UK sizes</option>
          </SelectField>
          <SelectField label="Fit" value={draft.fit} onChange={(e) => set('fit', e.target.value)}>
            <option value="true">True to size</option>
            <option value="small">Runs small</option>
            <option value="large">Runs large</option>
          </SelectField>
        </div>

        <fieldset className={`ap-fieldset${errors.categories ? ' ap-error' : ''}`} tabIndex={-1}>
          <legend className="field__label">Categories</legend>
          <div className="ap-chips">
            {lookups.categories.map((c) => {
              const on = draft.categories.includes(c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  className={`ap-chip${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => {
                    setDraft((d) => ({
                      ...d,
                      categories: d.categories.includes(c.code) ? d.categories.filter((x) => x !== c.code) : [...d.categories, c.code],
                    }));
                    setErrors((e) => ({ ...e, categories: undefined }));
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
          {errors.categories && <p className="field__error">{errors.categories}</p>}
        </fieldset>

        <TextAreaField
          label="Description"
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          error={errors.description}
          rows={4}
          maxLength={2000}
        />
        <TextAreaField
          label="Highlights"
          optional
          hint="One per line, e.g. “Leather upper”. Shown as bullet points."
          value={draft.highlights}
          onChange={(e) => set('highlights', e.target.value)}
          rows={3}
        />
        <div className="ap-form__grid">
          <TextAreaField label="Materials" optional value={draft.materials} onChange={(e) => set('materials', e.target.value)} rows={2} maxLength={1000} />
          <TextAreaField label="Care" optional value={draft.care} onChange={(e) => set('care', e.target.value)} rows={2} maxLength={1000} />
        </div>
      </section>

      <section className="ap-panel">
        <h2 className="ap-panel__title">Price and visibility</h2>
        <div className="ap-form__grid">
          <TextField
            label="Regular price (LKR)"
            inputMode="decimal"
            value={draft.regularPrice}
            onChange={(e) => set('regularPrice', e.target.value.replace(/[^\d.]/g, ''))}
            error={errors.regularPrice}
          />
          <TextField
            label="Sale price (LKR)"
            optional
            inputMode="decimal"
            hint="If set, customers pay this and see the regular price crossed out."
            value={draft.salePrice}
            onChange={(e) => set('salePrice', e.target.value.replace(/[^\d.]/g, ''))}
            error={errors.salePrice}
          />
        </div>
        <div className="ap-checks">
          <Checkbox label="Active: show this product in the shop" checked={draft.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          <Checkbox label="Featured on the home page" checked={draft.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} />
          <Checkbox label="Mark as a new arrival" checked={draft.isNewArrival} onChange={(e) => set('isNewArrival', e.target.checked)} />
        </div>
      </section>

      <section className="ap-panel">
        <header className="ap-panel__head">
          <div>
            <h2 className="ap-panel__title">Colours, sizes and images</h2>
            <p className="muted ap-small">Each colour has its own photos. Every size you tick becomes a SKU with zero stock until you receive stock.</p>
          </div>
          <Button variant="secondary" size="sm" icon={<Plus size={16} aria-hidden="true" />} onClick={() => set('colours', [...draft.colours, newColour(lookups)])}>
            Add colour
          </Button>
        </header>
        {errors.colours && <p className="field__error">{errors.colours}</p>}

        {draft.colours.map((c, index) => {
          const stockedSizes = c.stockedSizes;
          return (
            <div key={c.key} className="ap-colour">
              <div className="ap-colour__head">
                <span className="ap-swatch" style={{ background: c.swatch }} aria-hidden="true" />
                <strong>{c.name || `Colour ${index + 1}`}</strong>
                {draft.colours.length > 1 && (
                  <button
                    type="button"
                    className="text-link text-link--danger text-link--icon"
                    onClick={() => set('colours', draft.colours.filter((_, i) => i !== index))}
                    disabled={stockedSizes.length > 0}
                    title={stockedSizes.length > 0 ? 'This colour has stock. Adjust its stock to zero before removing it.' : undefined}
                  >
                    <Trash2 size={15} aria-hidden="true" /> Remove colour
                  </button>
                )}
              </div>
              <div className="ap-form__grid ap-form__grid--3">
                <TextField
                  label="Colour name"
                  value={c.name}
                  onChange={(e) => setColour(index, { name: e.target.value })}
                  error={errors[`colour-${index}-name`]}
                  maxLength={80}
                />
                <label className="field">
                  <span className="field__label">Swatch</span>
                  <input type="color" className="ap-color-input" value={c.swatch} onChange={(e) => setColour(index, { swatch: e.target.value })} />
                </label>
                <SelectField label="Colour family (for the shop filter)" value={c.family} onChange={(e) => setColour(index, { family: e.target.value })}>
                  {lookups.colourFamilies.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </SelectField>
              </div>

              <fieldset className={`ap-fieldset${errors[`colour-${index}-sizes`] ? ' ap-error' : ''}`} tabIndex={-1}>
                <legend className="field__label">Sizes (UK)</legend>
                <div className="ap-chips">
                  {sizes.map((s) => {
                    const on = c.sizes.includes(s.code);
                    const stocked = stockedSizes.includes(s.code);
                    return (
                      <button
                        key={s.code}
                        type="button"
                        className={`ap-chip ap-chip--size${on ? ' is-on' : ''}`}
                        aria-pressed={on}
                        disabled={on && stocked}
                        title={on && stocked ? 'This size has stock, so it can’t be removed.' : undefined}
                        onClick={() =>
                          setColour(index, (cur) => ({
                            sizes: cur.sizes.includes(s.code) ? cur.sizes.filter((x) => x !== s.code) : [...cur.sizes, s.code],
                          }))
                        }
                      >
                        {s.label}
                      </button>
                    );
                  })}
                  <button type="button" className="text-link" onClick={() => setColour(index, { sizes: Array.from(new Set([...stockedSizes, ...sizes.map((s) => s.code)])) })}>
                    Select all
                  </button>
                </div>
                {errors[`colour-${index}-sizes`] && <p className="field__error">{errors[`colour-${index}-sizes`]}</p>}
              </fieldset>

              <ImageManager images={c.images} colourName={c.name || 'This colour'} onChange={(images) => setColour(index, { images })} />
            </div>
          );
        })}
      </section>

      <div className="ap-form__actions">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button type="submit" variant="accent" size="lg" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
