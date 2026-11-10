import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { ErrorState, Spinner } from '../../components/ui/Feedback';
import { Checkbox, TextAreaField, TextField } from '../../components/ui/FormField';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useToast } from '../../hooks/useStore';
import { errorMessage } from '../../utils/errors';
import { adminApi } from '../api';
import { DataTable, PageHeader, Panel, Pill } from '../components';
import { formatDateTime, formatDay } from '../format';
import type { Supplier } from '../types';

export default function SettingsPage() {
  useDocumentTitle('Settings · Owner Portal');
  const settings = useAsync(() => adminApi.settings(), []);
  const suppliers = useAsync(() => adminApi.suppliers(), []);
  const { notify } = useToast();
  const [threshold, setThreshold] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Supplier | 'new'>();

  if (settings.error) return <ErrorState message={settings.error} onRetry={settings.reload} />;
  if (!settings.data) return <Spinner label="Loading settings" />;
  const value = threshold ?? String(settings.data.lowStockThreshold);

  const save = async () => {
    if (!/^\d+$/.test(value) || Number(value) > 1000) return notify('Enter a whole number from 0 to 1,000.', 'error');
    setSaving(true);
    try {
      await adminApi.updateSettings({ lowStockThreshold: Number(value) });
      settings.reload();
      setThreshold(undefined);
      notify('Settings saved.', 'success');
    } catch (e) {
      notify(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Stock alerts, suppliers and who can use the Owner Portal." />

      <div className="ap-grid ap-grid--2">
        <Panel title="Low-stock alerts">
          <p className="muted ap-small">
            A size shows as low stock when its quantity is at or below this number. You can override it for individual sizes on the Inventory
            page.
          </p>
          <div className="ap-inline-form">
            <TextField label="Store-wide low-stock threshold" inputMode="numeric" value={value} onChange={(e) => setThreshold(e.target.value.replace(/\D/g, ''))} />
            <Button variant="accent" onClick={save} loading={saving} disabled={value === String(settings.data.lowStockThreshold)}>
              Save
            </Button>
          </div>
          {settings.data.updatedAt && (
            <p className="muted ap-small">
              Last changed {formatDateTime(settings.data.updatedAt)}
              {settings.data.updatedBy ? ` by ${settings.data.updatedBy}` : ''}
            </p>
          )}
        </Panel>

        <Panel title="Owner accounts">
          <p className="muted ap-small">
            These email addresses can use the Owner Portal. The list is part of the server configuration (<code>Admin:OwnerEmails</code>), so
            nobody can grant themselves access from the website. Each owner signs up through the normal shop registration page.
          </p>
          <ul className="ap-owner-list">
            {settings.data.owners.map((o) => (
              <li key={o.email}>
                <div>
                  <strong>{o.name ?? o.email}</strong>
                  {o.name && <div className="muted ap-small">{o.email}</div>}
                </div>
                {o.hasAccount ? (
                  <span className="muted ap-small">{o.lastLoginAt ? `Last sign-in ${formatDay(o.lastLoginAt)}` : 'Account created'}</span>
                ) : (
                  <Pill tone="warn">Not registered yet</Pill>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Suppliers"
        actions={
          <Button variant="secondary" size="sm" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing('new')}>
            Add supplier
          </Button>
        }
      >
        {suppliers.error ? (
          <ErrorState message={suppliers.error} onRetry={suppliers.reload} />
        ) : (
          <DataTable loading={suppliers.loading} isEmpty={(suppliers.data ?? []).length === 0} colSpan={5} empty="No suppliers yet. They’re added automatically when you receive stock, or add one here.">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact</th>
                <th className="num">Receipts</th>
                <th>Last delivery</th>
                <th>
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(suppliers.data ?? []).map((s) => (
                <tr key={s.id} className={s.isActive ? '' : 'is-muted'}>
                  <td>
                    <strong>{s.name}</strong> {!s.isActive && <Pill tone="neutral">Inactive</Pill>}
                    {s.notes && <div className="muted ap-small">{s.notes}</div>}
                  </td>
                  <td className="ap-small">
                    {[s.contactName, s.phone, s.email].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="num">{s.receiptCount}</td>
                  <td className="ap-small">{formatDay(s.lastReceiptAt)}</td>
                  <td>
                    <button type="button" className="text-link text-link--icon" onClick={() => setEditing(s)}>
                      <Pencil size={15} aria-hidden="true" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Panel>

      {editing && (
        <SupplierDialog
          supplier={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            suppliers.reload();
          }}
        />
      )}
    </>
  );
}

function SupplierDialog({ supplier, onClose, onSaved }: { supplier?: Supplier; onClose: () => void; onSaved: () => void }) {
  const { notify } = useToast();
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    contactName: supplier?.contactName ?? '',
    phone: supplier?.phone ?? '',
    email: supplier?.email ?? '',
    notes: supplier?.notes ?? '',
    isActive: supplier?.isActive ?? true,
  });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return setError('Enter the supplier’s name.');
    setBusy(true);
    try {
      await adminApi.saveSupplier(supplier?.id ?? null, {
        name: form.name.trim(),
        contactName: form.contactName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        isActive: form.isActive,
      });
      notify('Supplier saved.', 'success');
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={supplier ? `Edit ${supplier.name}` : 'Add supplier'}
      footer={
        <div className="ap-dialog-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save} loading={busy}>
            Save supplier
          </Button>
        </div>
      }
    >
      <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={error} maxLength={120} />
      <TextField label="Contact person" optional value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} maxLength={80} />
      <TextField label="Phone" optional value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={30} />
      <TextField label="Email" optional type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={256} />
      <TextAreaField label="Notes" optional value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} maxLength={500} />
      <Checkbox label="Active (shown when receiving stock)" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
    </Dialog>
  );
}
