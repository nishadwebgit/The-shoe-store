import { Link } from 'react-router-dom';
import { ErrorState } from '../../components/ui/Feedback';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { adminApi } from '../api';
import { DataTable, PageHeader, Pagination, Pill, SearchInput } from '../components';
import { formatDay, formatLkr } from '../format';
import { useUrlFilters } from '../hooks';

export default function CustomersPage() {
  useDocumentTitle('Customers · Owner Portal');
  const [f, setF] = useUrlFilters({ search: '', page: '1' });
  const list = useAsync(() => adminApi.customers({ search: f.search, page: f.page, pageSize: 20 }), [f.search, f.page]);
  const items = list.data?.items ?? [];

  return (
    <>
      <PageHeader title="Customers" description="Registered customer accounts and what they’ve spent. Guest orders appear under Customer orders." />
      <div className="ap-toolbar">
        <SearchInput value={f.search} onChange={(search) => setF({ search })} placeholder="Search name, email or phone" />
      </div>
      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <>
          <DataTable loading={list.loading} isEmpty={items.length === 0} colSpan={6} empty="No customers match your search.">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>Joined</th>
                <th className="num">Orders</th>
                <th className="num">Spent</th>
                <th>Last order</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong> {c.role === 'admin' && <Pill tone="accent">Owner</Pill>}
                    <div className="muted ap-small">{c.email}</div>
                  </td>
                  <td>{c.phone ?? '—'}</td>
                  <td className="ap-small">
                    {formatDay(c.joinedAt)}
                    {c.lastLoginAt && <div className="muted">last sign-in {formatDay(c.lastLoginAt)}</div>}
                  </td>
                  <td className="num">
                    {c.orderCount > 0 ? (
                      <Link className="text-link" to={`/admin/orders?search=${encodeURIComponent(c.email)}`}>
                        {c.orderCount}
                      </Link>
                    ) : (
                      0
                    )}
                  </td>
                  <td className="num">{formatLkr(c.totalSpent)}</td>
                  <td className="ap-small">{formatDay(c.lastOrderAt)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
          {list.data && (
            <Pagination page={list.data.page} totalPages={list.data.totalPages} totalCount={list.data.totalCount} onPage={(page) => setF({ page: String(page) })} />
          )}
        </>
      )}
    </>
  );
}
