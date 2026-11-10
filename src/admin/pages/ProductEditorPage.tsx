import { useState } from 'react';
import { ExternalLink, Truck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ErrorState, Spinner } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../hooks/useStore';
import { errorMessage } from '../../utils/errors';
import { adminApi } from '../api';
import { ConfirmDialog, DataTable, PageHeader, Panel, Pill, StockPill } from '../components';
import { formatDateTime } from '../format';
import { ProductForm } from '../ProductForm';
import type { AdminProduct } from '../types';

export default function ProductEditorPage() {
  const { id } = useParams();
  const productId = id ? Number(id) : undefined;
  const isNew = productId === undefined;
  const navigate = useNavigate();
  const { notify } = useToast();
  const lookups = useAsync(() => adminApi.lookups(), []);
  const loaded = useAsync(() => (productId ? adminApi.product(productId) : Promise.resolve(undefined)), [productId]);
  const [saved, setSaved] = useState<AdminProduct>();
  const [version, setVersion] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const product = saved && saved.id === productId ? saved : loaded.data;
  useDocumentTitle(isNew ? 'Add product · Owner Portal' : `${product?.name ?? 'Product'} · Owner Portal`);

  if (lookups.error || loaded.error) {
    return <ErrorState message={lookups.error ?? loaded.error ?? ''} onRetry={() => (lookups.error ? lookups.reload() : loaded.reload())} />;
  }
  if (!lookups.data || (!isNew && !product)) return <Spinner label="Loading product" />;

  const remove = async () => {
    if (!product) return;
    setDeleting(true);
    try {
      await adminApi.deleteProduct(product.id);
      notify(`${product.name} was deleted.`, 'success');
      navigate('/admin/products', { replace: true });
    } catch (e) {
      notify(errorMessage(e), 'error');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <PageHeader
        title={isNew ? 'Add new product' : product!.name}
        description={
          isNew ? (
            'Create the product, its colours, sizes and photos. Then receive stock to make it available to buy.'
          ) : (
            <>
              {product!.code} · {product!.brand} · {product!.totalStock} pairs in stock{' '}
              {product!.isActive ? <Pill tone="good">Active</Pill> : <Pill tone="neutral">Inactive</Pill>}
            </>
          )
        }
        actions={
          !isNew && (
            <>
              <ButtonLink to={`/admin/receive-stock?product=${product!.id}`} variant="accent" icon={<Truck size={18} aria-hidden="true" />}>
                Receive stock
              </ButtonLink>
              {product!.isActive && (
                <a className="btn btn--secondary btn--md" href={`/product/${product!.slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} aria-hidden="true" />
                  <span>View in shop</span>
                </a>
              )}
            </>
          )
        }
      />

      <div className={isNew ? '' : 'ap-grid ap-grid--editor'}>
        <ProductForm
          key={`${product?.id ?? 'new'}-${version}`}
          product={product}
          lookups={lookups.data}
          submitLabel={isNew ? 'Create product' : 'Save changes'}
          onCancel={() => navigate('/admin/products')}
          onSubmit={async (request) => {
            try {
              if (isNew) {
                const created = await adminApi.createProduct(request);
                notify(`${created.name} was created. Receive stock to make it available to buy.`, 'success');
                navigate(`/admin/products/${created.id}`, { replace: true });
              } else {
                const updated = await adminApi.updateProduct(product!.id, request);
                setSaved(updated);
                setVersion((v) => v + 1);
                notify('Changes saved.', 'success');
              }
            } catch (e) {
              notify(errorMessage(e), 'error');
            }
          }}
        />

        {!isNew && product && (
          <aside className="ap-side">
            <Panel title="Stock by size">
              <DataTable isEmpty={product.variants.length === 0} colSpan={3} empty="No sizes yet.">
                <thead>
                  <tr>
                    <th>Colour</th>
                    <th>UK</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => (
                    <tr key={v.id}>
                      <td className="ap-small">{v.colourName}</td>
                      <td>{v.sizeLabel}</td>
                      <td>
                        <StockPill state={v.stockState} quantity={v.stock} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <p className="ap-small">
                <Link className="text-link" to={`/admin/inventory?product=${product.id}`}>
                  Adjust stock in Inventory
                </Link>{' '}
                ·{' '}
                <Link className="text-link" to={`/admin/stock-history?product=${product.id}`}>
                  Stock history
                </Link>
              </p>
            </Panel>

            <Panel title="Record">
              <dl className="ap-dl">
                <dt>Created</dt>
                <dd>
                  {formatDateTime(product.createdAt)}
                  {product.createdBy && <span className="muted"> by {product.createdBy}</span>}
                </dd>
                <dt>Last changed</dt>
                <dd>
                  {formatDateTime(product.updatedAt ?? product.createdAt)}
                  {product.updatedBy && <span className="muted"> by {product.updatedBy}</span>}
                </dd>
                <dt>Shop address</dt>
                <dd className="ap-small">/product/{product.slug}</dd>
              </dl>
            </Panel>

            <Panel title="Delete product">
              {product.canDelete ? (
                <>
                  <p className="ap-small muted">Deleting removes the product, its colours, sizes and images. This can’t be undone.</p>
                  <Button variant="secondary" className="btn--danger-outline" onClick={() => setConfirmDelete(true)}>
                    Delete product
                  </Button>
                </>
              ) : (
                <p className="ap-small muted">{product.deleteBlockedReason}</p>
              )}
            </Panel>
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this product?"
        confirmLabel="Delete product"
        tone="danger"
        busy={deleting}
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      >
        <p>
          <strong>{product?.name}</strong> will be removed from the catalogue with all its colours, sizes and images. Stock history keeps its
          records. This can’t be undone.
        </p>
      </ConfirmDialog>
    </>
  );
}
