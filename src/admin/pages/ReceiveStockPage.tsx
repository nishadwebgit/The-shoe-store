import { useMemo, useState, type ReactNode } from 'react';
import { Check, CheckCircle2, ChevronLeft, ChevronRight, PackagePlus, Plus, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ErrorState, Spinner } from '../../components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '../../components/ui/FormField';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../hooks/useStore';
import { errorMessage } from '../../utils/errors';
import { adminApi, newRequestId } from '../api';
import { DataTable, PageHeader, Panel, Pill, Thumb } from '../components';
import { formatDay, formatLkr } from '../format';
import { ImageManager, type ImageItem } from '../ImageManager';
import { ProductForm } from '../ProductForm';
import type { AdminProduct, Lookups, ProductRequest, StockReceipt } from '../types';

const steps = ['Product', 'Stock details', 'Sizes and quantities', 'Images', 'Review and confirm'];

interface Details {
  supplier: string;
  supplierReference: string;
  receivedDate: string;
  unitCost: string;
  sellingPrice: string;
  notes: string;
}

const today = () => new Date().toISOString().slice(0, 10);

function productToRequest(p: AdminProduct, images: Record<number, ImageItem[]>): ProductRequest {
  return {
    name: p.name,
    code: p.code,
    brandId: p.brandId,
    newBrandName: null,
    categories: p.categories,
    gender: p.gender,
    sizeSystem: p.sizeSystem,
    fit: p.fit,
    silhouette: p.silhouette,
    description: p.description,
    materials: p.materials || null,
    care: p.care || null,
    regularPrice: p.regularPrice,
    salePrice: p.salePrice,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isNewArrival: p.isNewArrival,
    highlights: p.highlights,
    colours: p.colours.map((c) => ({
      id: c.id,
      name: c.name,
      swatch: c.swatch,
      family: c.family,
      sizes: p.variants.filter((v) => v.colourId === c.id).map((v) => v.size),
      images: images[c.id] ?? c.images.map((i) => ({ url: i.url, altText: i.altText })),
    })),
  };
}

/**
 * "Receive new stock" wizard: pick or create the product, enter the delivery details, the quantity
 * received for each colour and size, update photos, then review and confirm. Confirming adds the
 * quantities to existing stock (never overwrites it) and records everything in Stock history.
 */
export default function ReceiveStockPage() {
  useDocumentTitle('Receive stock · Owner Portal');
  const [params, setParams] = useSearchParams();
  const lookups = useAsync(() => adminApi.lookups(), []);
  const productId = params.get('product') ? Number(params.get('product')) : undefined;
  const productState = useAsync(() => (productId ? adminApi.product(productId) : Promise.resolve(undefined)), [productId]);

  const [step, setStep] = useState(productId ? 1 : 0);
  const [details, setDetails] = useState<Details>({ supplier: '', supplierReference: '', receivedDate: today(), unitCost: '', sellingPrice: '', notes: '' });
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [images, setImages] = useState<Record<number, ImageItem[]>>({});
  const [requestId, setRequestId] = useState(newRequestId);
  const [result, setResult] = useState<StockReceipt>();
  const [productOverride, setProductOverride] = useState<AdminProduct>();
  const product = productOverride && productOverride.id === productId ? productOverride : productState.data;
  const [lastProductId, setLastProductId] = useState(productId);
  if (productId !== lastProductId) {
    // A different product was chosen: start its receipt fresh.
    setLastProductId(productId);
    setQuantities({});
    setImages({});
    setDetails((d) => ({ ...d, sellingPrice: '' }));
  }

  const choose = (id: number) => {
    setParams({ product: String(id) }, { replace: true });
    setResult(undefined);
    setStep(1);
  };

  const reset = () => {
    setParams({}, { replace: true });
    setDetails({ supplier: '', supplierReference: '', receivedDate: today(), unitCost: '', sellingPrice: '', notes: '' });
    setQuantities({});
    setImages({});
    setRequestId(newRequestId());
    setResult(undefined);
    setProductOverride(undefined);
    setStep(0);
  };

  if (lookups.error) return <ErrorState message={lookups.error} onRetry={lookups.reload} />;
  if (!lookups.data) return <Spinner label="Loading" />;

  if (result) return <ReceiptDone receipt={result} onAgain={reset} />;

  const needsProduct = step > 0 && !product;

  return (
    <>
      <PageHeader title="Receive new stock" description="Record a delivery from a supplier. Quantities are added to what you already have." />

      <ol className="ap-steps" aria-label="Progress">
        {steps.map((label, i) => (
          <li key={label} className={i === step ? 'is-current' : i < step ? 'is-done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span className="ap-steps__dot">{i < step ? <Check size={14} /> : i + 1}</span>
            <span className="ap-steps__label">{label}</span>
          </li>
        ))}
      </ol>

      {needsProduct ? (
        productState.loading ? (
          <Spinner label="Loading product" />
        ) : (
          <ErrorState message={productState.error ?? 'Choose a product first.'} onRetry={() => setStep(0)} />
        )
      ) : step === 0 ? (
        <StepProduct lookups={lookups.data} selected={product} onChoose={choose} onCreated={(p) => { setProductOverride(p); choose(p.id); }} />
      ) : step === 1 ? (
        <StepDetails product={product!} lookups={lookups.data} details={details} onChange={setDetails} onBack={() => setStep(0)} onNext={() => setStep(2)} />
      ) : step === 2 ? (
        <StepQuantities
          product={product!}
          lookups={lookups.data}
          quantities={quantities}
          onChange={setQuantities}
          onProductChange={setProductOverride}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      ) : step === 3 ? (
        <StepImages product={product!} images={images} onChange={setImages} onBack={() => setStep(2)} onNext={() => setStep(4)} />
      ) : (
        <StepReview
          product={product!}
          lookups={lookups.data}
          details={details}
          quantities={quantities}
          images={images}
          requestId={requestId}
          onBack={() => setStep(3)}
          onEdit={setStep}
          onDone={(receipt) => {
            setResult(receipt);
            setRequestId(newRequestId());
          }}
        />
      )}
    </>
  );
}

function StepNav({ onBack, onNext, nextLabel = 'Continue', nextDisabled, busy }: { onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean; busy?: boolean }) {
  return (
    <div className="ap-form__actions">
      {onBack && (
        <Button variant="ghost" onClick={onBack} icon={<ChevronLeft size={18} aria-hidden="true" />} disabled={busy}>
          Back
        </Button>
      )}
      <Button variant="accent" size="lg" onClick={onNext} disabled={nextDisabled} loading={busy}>
        {nextLabel}
        {!busy && nextLabel === 'Continue' && <ChevronRight size={18} aria-hidden="true" />}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------- Step 1: product

function StepProduct({
  lookups,
  selected,
  onChoose,
  onCreated,
}: {
  lookups: Lookups;
  selected?: AdminProduct;
  onChoose: (id: number) => void;
  onCreated: (product: AdminProduct) => void;
}) {
  const { notify } = useToast();
  const [mode, setMode] = useState<'find' | 'create'>('find');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const results = useAsync(() => adminApi.products({ search: query, pageSize: 8, sort: query ? 'name' : 'updated' }), [query]);

  if (mode === 'create') {
    return (
      <>
        <Panel>
          <p className="ap-small">
            Creating a new product. After saving you’ll enter the delivery details and quantities. <button type="button" className="text-link" onClick={() => setMode('find')}>Choose an existing product instead</button>
          </p>
        </Panel>
        <ProductForm
          lookups={lookups}
          submitLabel="Create product and continue"
          onCancel={() => setMode('find')}
          onSubmit={async (request) => {
            try {
              const created = await adminApi.createProduct(request);
              notify(`${created.name} was created.`, 'success');
              onCreated(created);
            } catch (e) {
              notify(errorMessage(e), 'error');
            }
          }}
        />
      </>
    );
  }

  return (
    <Panel
      title="Which product did you receive?"
      actions={
        <Button variant="secondary" icon={<PackagePlus size={18} aria-hidden="true" />} onClick={() => setMode('create')}>
          Create a new product
        </Button>
      }
    >
      <form
        className="ap-search ap-search--large"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <Search size={20} aria-hidden="true" />
        <label htmlFor="receive-search" className="visually-hidden">
          Search products
        </label>
        <input id="receive-search" type="search" placeholder="Search by name, product code, SKU or brand" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" size="sm">
          Search
        </Button>
      </form>

      {results.error ? (
        <ErrorState message={results.error} onRetry={results.reload} />
      ) : (
        <ul className="ap-pick-list" aria-busy={results.loading}>
          {(results.data?.items ?? []).map((p) => (
            <li key={p.id}>
              <button type="button" className={`ap-pick${selected?.id === p.id ? ' is-selected' : ''}`} onClick={() => onChoose(p.id)}>
                <Thumb src={p.image} alt="" />
                <span className="ap-pick__main">
                  <strong>{p.name}</strong>
                  <span className="muted ap-small">
                    {p.code} · {p.brand} · {p.categories.join(', ')}
                  </span>
                </span>
                <span className="ap-pick__meta">
                  <strong>{p.totalStock}</strong> <span className="muted ap-small">in stock</span>
                  {!p.isActive && <Pill tone="neutral">Inactive</Pill>}
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
          {!results.loading && results.data?.items.length === 0 && (
            <li className="muted">
              No products match “{query}”. <button type="button" className="text-link" onClick={() => setMode('create')}>Create it as a new product</button>.
            </li>
          )}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- Product summary (shown on later steps)

function ProductSummary({ product, action }: { product: AdminProduct; action?: ReactNode }) {
  const image = product.colours[0]?.images[0]?.url ?? null;
  return (
    <div className="ap-product-summary">
      <Thumb src={image} alt="" />
      <div>
        <strong>{product.name}</strong>
        <div className="muted ap-small">
          {product.code} · {product.brand} · {formatLkr(product.salePrice ?? product.regularPrice)} · {product.colours.length} colour
          {product.colours.length === 1 ? '' : 's'} · {product.totalStock} pairs in stock
        </div>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- Step 2: delivery details

function StepDetails({
  product,
  lookups,
  details,
  onChange,
  onBack,
  onNext,
}: {
  product: AdminProduct;
  lookups: Lookups;
  details: Details;
  onChange: (d: Details) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const set = (key: keyof Details, value: string) => onChange({ ...details, [key]: value });

  const next = () => {
    const e: typeof errors = {};
    if (!details.receivedDate) e.receivedDate = 'Enter the date the stock arrived.';
    else if (details.receivedDate > today()) e.receivedDate = 'The date can’t be in the future.';
    if (details.unitCost && !(Number(details.unitCost) >= 0)) e.unitCost = 'Enter a valid cost price or leave it empty.';
    if (details.sellingPrice && !(Number(details.sellingPrice) > 0)) e.sellingPrice = 'Enter a valid selling price or leave it empty.';
    setErrors(e);
    if (Object.keys(e).length === 0) onNext();
  };

  return (
    <>
      <Panel>
        <ProductSummary
          product={product}
          action={
            <Link className="text-link" to={`/admin/products/${product.id}`}>
              Edit product details
            </Link>
          }
        />
      </Panel>
      <Panel title="Delivery details">
        <div className="ap-form__grid">
          <div className="field">
            <label className="field__label" htmlFor="supplier">
              Supplier <span className="field__optional">(optional)</span>
            </label>
            <p className="field__hint">Pick one you’ve used before or type a new name.</p>
            <input id="supplier" className="input" list="supplier-list" value={details.supplier} onChange={(e) => set('supplier', e.target.value)} maxLength={120} />
            <datalist id="supplier-list">
              {lookups.suppliers.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>
          <TextField
            label="Supplier invoice or reference number"
            optional
            value={details.supplierReference}
            onChange={(e) => set('supplierReference', e.target.value)}
            maxLength={60}
          />
          <TextField label="Date received" type="date" max={today()} value={details.receivedDate} onChange={(e) => set('receivedDate', e.target.value)} error={errors.receivedDate} />
          <TextField
            label="Cost price per pair (LKR)"
            optional
            inputMode="decimal"
            value={details.unitCost}
            onChange={(e) => set('unitCost', e.target.value.replace(/[^\d.]/g, ''))}
            error={errors.unitCost}
            hint="Only you see this. Used for stock value."
          />
          <TextField
            label="Selling price (LKR)"
            optional
            inputMode="decimal"
            value={details.sellingPrice}
            onChange={(e) => set('sellingPrice', e.target.value.replace(/[^\d.]/g, ''))}
            error={errors.sellingPrice}
            hint={`Current: ${formatLkr(product.regularPrice)}${product.salePrice ? ` (on sale at ${formatLkr(product.salePrice)})` : ''}. Leave empty to keep it.`}
          />
        </div>
        <TextAreaField label="Notes" optional value={details.notes} onChange={(e) => set('notes', e.target.value)} rows={2} maxLength={500} />
      </Panel>
      <StepNav onBack={onBack} onNext={next} />
    </>
  );
}

// ---------------------------------------------------------------- Step 3: quantities per colour and size

function StepQuantities({
  product,
  lookups,
  quantities,
  onChange,
  onProductChange,
  onBack,
  onNext,
}: {
  product: AdminProduct;
  lookups: Lookups;
  quantities: Record<string, string>;
  onChange: (q: Record<string, string>) => void;
  onProductChange: (p: AdminProduct) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const { notify } = useToast();
  const [error, setError] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [colour, setColour] = useState({ name: '', swatch: '#1b1d22', family: lookups.colourFamilies[0]?.value ?? 'black' });
  const [savingColour, setSavingColour] = useState(false);
  const sizes = lookups.sizes.filter((s) => s.sizeSystem === product.sizeSystem);
  const stockOf = (colourId: number, size: string) => product.variants.find((v) => v.colourId === colourId && v.size === size);
  const total = Object.values(quantities).reduce((sum, v) => sum + (Number(v) || 0), 0);

  const next = () => {
    const values = Object.values(quantities).filter((v) => v !== '');
    if (values.some((v) => !/^\d+$/.test(v) || Number(v) > 10000)) return setError('Quantities must be whole numbers between 0 and 10,000.');
    if (total <= 0) return setError('Enter the quantity received for at least one size.');
    setError(undefined);
    onNext();
  };

  const addColour = async () => {
    if (!colour.name.trim()) return notify('Name the new colour first.', 'error');
    setSavingColour(true);
    try {
      onProductChange(await adminApi.addColour(product.id, { ...colour, name: colour.name.trim() }));
      setAdding(false);
      setColour({ ...colour, name: '' });
      notify('Colour added. Enter its quantities below and add its photos in the next step.', 'success');
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setSavingColour(false);
    }
  };

  return (
    <>
      <Panel>
        <ProductSummary product={product} />
      </Panel>
      <Panel
        title="How many pairs did you receive?"
        actions={
          <Button variant="secondary" size="sm" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setAdding((a) => !a)}>
            New colour
          </Button>
        }
      >
        <p className="muted ap-small">Enter the quantity for each colour and size that arrived. Leave the rest empty. The small number is the current stock.</p>

        {adding && (
          <div className="ap-inline-form">
            <TextField label="Colour name" value={colour.name} onChange={(e) => setColour({ ...colour, name: e.target.value })} maxLength={80} />
            <label className="field">
              <span className="field__label">Swatch</span>
              <input type="color" className="ap-color-input" value={colour.swatch} onChange={(e) => setColour({ ...colour, swatch: e.target.value })} />
            </label>
            <SelectField label="Colour family" value={colour.family} onChange={(e) => setColour({ ...colour, family: e.target.value })}>
              {lookups.colourFamilies.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </SelectField>
            <Button variant="primary" onClick={addColour} loading={savingColour}>
              Add colour
            </Button>
          </div>
        )}

        <div className="ap-table-wrap">
          <table className="ap-table ap-qty-grid">
            <thead>
              <tr>
                <th>Colour</th>
                {sizes.map((s) => (
                  <th key={s.code} className="num">
                    UK {s.label}
                  </th>
                ))}
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {product.colours.map((c) => {
                const rowTotal = sizes.reduce((sum, s) => sum + (Number(quantities[`${c.id}|${s.code}`]) || 0), 0);
                return (
                  <tr key={c.id}>
                    <th scope="row">
                      <span className="ap-swatch" style={{ background: c.swatch }} aria-hidden="true" /> {c.name}
                    </th>
                    {sizes.map((s) => {
                      const key = `${c.id}|${s.code}`;
                      const existing = stockOf(c.id, s.code);
                      return (
                        <td key={s.code} className={`num${existing ? '' : ' is-new-size'}`}>
                          <input
                            className="input ap-qty"
                            inputMode="numeric"
                            aria-label={`${c.name}, UK ${s.label}, quantity received`}
                            value={quantities[key] ?? ''}
                            placeholder="0"
                            onChange={(e) => onChange({ ...quantities, [key]: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                          />
                          <span className="ap-qty__current">{existing ? `has ${existing.stock}` : 'new size'}</span>
                        </td>
                      );
                    })}
                    <td className="num">
                      <strong>{rowTotal || ''}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="ap-total-line">
          Total received: <strong>{total} pairs</strong>
        </p>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
      </Panel>
      <StepNav onBack={onBack} onNext={next} />
    </>
  );
}

// ---------------------------------------------------------------- Step 4: images

function StepImages({
  product,
  images,
  onChange,
  onBack,
  onNext,
}: {
  product: AdminProduct;
  images: Record<number, ImageItem[]>;
  onChange: (images: Record<number, ImageItem[]>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <Panel title="Product images">
        <p className="muted ap-small">
          Add or update photos for each colour. New photos upload now and are saved to the product when you confirm the receipt. Skip this step if
          the photos are already right.
        </p>
        {product.colours.map((c) => (
          <div key={c.id} className="ap-colour">
            <div className="ap-colour__head">
              <span className="ap-swatch" style={{ background: c.swatch }} aria-hidden="true" />
              <strong>{c.name}</strong>
              {(images[c.id] ?? c.images).length === 0 && <Pill tone="warn">No photos yet</Pill>}
            </div>
            <ImageManager
              images={images[c.id] ?? c.images.map((i) => ({ url: i.url, altText: i.altText }))}
              colourName={c.name}
              onChange={(list) => onChange({ ...images, [c.id]: list })}
            />
          </div>
        ))}
      </Panel>
      <StepNav onBack={onBack} onNext={onNext} />
    </>
  );
}

// ---------------------------------------------------------------- Step 5: review and confirm

function StepReview({
  product,
  lookups,
  details,
  quantities,
  images,
  requestId,
  onBack,
  onEdit,
  onDone,
}: {
  product: AdminProduct;
  lookups: Lookups;
  details: Details;
  quantities: Record<string, string>;
  images: Record<number, ImageItem[]>;
  requestId: string;
  onBack: () => void;
  onEdit: (step: number) => void;
  onDone: (receipt: StockReceipt) => void;
}) {
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const lines = useMemo(
    () =>
      Object.entries(quantities)
        .map(([key, value]) => {
          const [colourId, size] = key.split('|');
          return { colourId: Number(colourId), size, quantity: Number(value) || 0 };
        })
        .filter((l) => l.quantity > 0 && product.colours.some((c) => c.id === l.colourId)),
    [quantities, product],
  );
  const total = lines.reduce((s, l) => s + l.quantity, 0);
  const imagesChanged = Object.entries(images).some(([id, list]) => {
    const original = product.colours.find((c) => c.id === Number(id))?.images.map((i) => i.url) ?? [];
    return JSON.stringify(original) !== JSON.stringify(list.map((i) => i.url));
  });
  const supplierMatch = lookups.suppliers.find((s) => s.name.toLowerCase() === details.supplier.trim().toLowerCase());
  const unitCost = details.unitCost ? Number(details.unitCost) : null;

  const confirm = async () => {
    setBusy(true);
    setError(undefined);
    try {
      if (imagesChanged) await adminApi.updateProduct(product.id, productToRequest(product, images));
      const receipt = await adminApi.receiveStock({
        clientRequestId: requestId,
        productId: product.id,
        supplierId: supplierMatch?.id ?? null,
        supplierName: supplierMatch ? null : details.supplier.trim() || null,
        supplierReference: details.supplierReference.trim() || null,
        receivedDate: details.receivedDate,
        unitCost,
        sellingPrice: details.sellingPrice ? Number(details.sellingPrice) : null,
        notes: details.notes.trim() || null,
        lines,
      });
      notify(`${receipt.receiptNumber} recorded: ${receipt.totalQuantity} pairs added to stock.`, 'success');
      onDone(receipt);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <>
      <Panel title="Check everything before confirming">
        <ProductSummary product={product} action={<button type="button" className="text-link" onClick={() => onEdit(0)}>Change product</button>} />
        <dl className="ap-dl ap-dl--grid">
          <dt>Supplier</dt>
          <dd>
            {details.supplier.trim() || '—'}
            {details.supplier.trim() && !supplierMatch && <span className="muted"> (new supplier)</span>}
          </dd>
          <dt>Invoice / reference</dt>
          <dd>{details.supplierReference.trim() || '—'}</dd>
          <dt>Date received</dt>
          <dd>{formatDay(details.receivedDate)}</dd>
          <dt>Cost price</dt>
          <dd>{unitCost !== null ? `${formatLkr(unitCost)} per pair · ${formatLkr(unitCost * total)} total` : '—'}</dd>
          <dt>Selling price</dt>
          <dd>{details.sellingPrice ? `${formatLkr(Number(details.sellingPrice))} (was ${formatLkr(product.regularPrice)})` : `${formatLkr(product.regularPrice)} (unchanged)`}</dd>
          <dt>Notes</dt>
          <dd>{details.notes.trim() || '—'}</dd>
          <dt>Images</dt>
          <dd>{imagesChanged ? 'Updated photos will be saved' : 'No changes'}</dd>
        </dl>
        <button type="button" className="text-link" onClick={() => onEdit(1)}>
          Edit delivery details
        </button>
      </Panel>

      <Panel title={`Quantities (${total} pairs)`} actions={<button type="button" className="text-link" onClick={() => onEdit(2)}>Edit quantities</button>}>
        <DataTable colSpan={5}>
          <thead>
            <tr>
              <th>Colour</th>
              <th>Size</th>
              <th className="num">Current stock</th>
              <th className="num">Received</th>
              <th className="num">New stock</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const colour = product.colours.find((c) => c.id === l.colourId)!;
              const current = product.variants.find((v) => v.colourId === l.colourId && v.size === l.size)?.stock ?? 0;
              return (
                <tr key={`${l.colourId}-${l.size}`}>
                  <td>
                    <span className="ap-swatch" style={{ background: colour.swatch }} aria-hidden="true" /> {colour.name}
                  </td>
                  <td>UK {l.size.replace('K', '')}</td>
                  <td className="num">{current}</td>
                  <td className="num">
                    <span className="ap-change ap-change--up">+{l.quantity}</span>
                  </td>
                  <td className="num">
                    <strong>{current + l.quantity}</strong>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </DataTable>
        <p className="muted ap-small">Stock shown is from when you opened this page. The final figures are calculated when you confirm, so sales made meanwhile are kept.</p>
      </Panel>

      {error && (
        <p className="ap-alert ap-alert--danger" role="alert">
          {error}
        </p>
      )}
      <StepNav onBack={onBack} onNext={confirm} nextLabel={`Confirm and add ${total} pairs`} busy={busy} nextDisabled={total === 0} />
    </>
  );
}

// ---------------------------------------------------------------- Done

function ReceiptDone({ receipt, onAgain }: { receipt: StockReceipt; onAgain: () => void }) {
  return (
    <>
      <PageHeader title="Stock received" />
      <Panel>
        <div className="ap-success">
          <CheckCircle2 size={40} aria-hidden="true" />
          <div>
            <h2>
              {receipt.receiptNumber}: {receipt.totalQuantity} pairs added
            </h2>
            <p className="muted">
              {receipt.productName} · received {formatDay(receipt.receivedDate)}
              {receipt.supplier ? ` from ${receipt.supplier}` : ''}
              {receipt.supplierReference ? ` · invoice ${receipt.supplierReference}` : ''} · recorded by {receipt.receivedBy}
            </p>
          </div>
        </div>
        <DataTable colSpan={5}>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Colour / size</th>
              <th className="num">Before</th>
              <th className="num">Received</th>
              <th className="num">Now</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((l) => (
              <tr key={l.sku}>
                <td className="ap-mono">{l.sku}</td>
                <td>
                  {l.colour} · UK {l.size.replace('K', '')}
                </td>
                <td className="num">{l.previousQuantity}</td>
                <td className="num">
                  <span className="ap-change ap-change--up">+{l.quantity}</span>
                </td>
                <td className="num">
                  <strong>{l.newQuantity}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
        <div className="ap-form__actions ap-form__actions--start">
          <Button variant="accent" onClick={onAgain}>
            Receive more stock
          </Button>
          {receipt.productId && (
            <ButtonLink variant="secondary" to={`/admin/products/${receipt.productId}`}>
              View product
            </ButtonLink>
          )}
          <ButtonLink variant="ghost" to={`/admin/stock-history?tab=receipts&receipt=${receipt.id}`}>
            Stock history
          </ButtonLink>
        </div>
      </Panel>
    </>
  );
}
