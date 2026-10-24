import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Search } from 'lucide-react';
import { getFactoryOrdersQueryKey, useFactoryOrders } from '@workspace/api-client-react';
import { Badge, Empty, ErrorState, PageHead, ProgressBar, Skeleton } from '@/components/bits';
import { POLL, fmtDate, fmtMoney, useAuth } from '@/lib/factory';

export default function Orders() {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const params = useMemo(() => ({ ...(search ? { search } : {}), ...(status ? { status } : {}) }), [search, status]);
  const hasParams = !!(search || status);
  const q = useFactoryOrders(hasParams ? params : undefined, { query: { queryKey: getFactoryOrdersQueryKey(hasParams ? params : undefined), refetchInterval: POLL } });
  const all = useFactoryOrders(undefined, { query: { queryKey: getFactoryOrdersQueryKey(undefined), refetchInterval: POLL } });
  const statuses = useMemo(() => Array.from(new Set((all.data ?? []).map((o) => o.status))).sort(), [all.data]);
  const commercial = user?.role !== 'Factory Operator';

  return (
    <>
      <PageHead kicker={commercial ? (user?.role === 'Sales' ? 'Your commercial orders' : 'All commercial orders') : 'Official orders in the factory queue'} title={commercial ? 'Orders' : 'Factory orders'}>
        {user?.role === 'Sales' && <Link href="/orders/new" className="ff-btn ff-btn-primary" data-testid="link-new-order">New order</Link>}
      </PageHead>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="ff-field !pl-9" placeholder="Search number, company, product" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} data-testid="input-search" />
        </div>
        <select className="ff-field sm:w-60" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="select-status">
          <option value="">All statuses</option>
          {status && !statuses.includes(status) && <option value={status}>{status}</option>}
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {q.isLoading && <Skeleton rows={6} />}
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <Empty
          title={hasParams ? 'No orders match' : 'No orders yet'}
          hint={hasParams ? 'Try a different search or clear the status filter.' : user?.role === 'Sales' ? 'Submit your first customer order to start a batch.' : 'Orders appear here once available to your role.'}
          action={hasParams ? <button className="ff-btn ff-btn-line" onClick={() => { setText(''); setStatus(''); }} data-testid="button-clear-filters">Clear filters</button> : undefined}
        />
      )}
      {q.data && q.data.length > 0 && (
        <div className="ff-panel ff-up overflow-hidden">
          <ul className="divide-y">
            {q.data.map((o) => (
              <li key={o.id}>
                <Link href={`/orders/${o.id}`} className="ff-row grid gap-2 px-4 py-3.5 md:grid-cols-[170px_1fr_190px_150px] md:items-center" data-testid={`row-order-${o.id}`}>
                  <div>
                    <div className="ff-mono text-sm font-semibold">{o.officialNumber ?? o.number}</div>
                    {o.officialNumber && <div className="ff-mono text-[11px] text-muted-foreground">ref {o.number}</div>}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{o.company}</div>
                    <div className="text-xs text-muted-foreground">
                      {o.lines.length} line{o.lines.length === 1 ? '' : 's'} · due {o.deliveryDate}
                      {o.total !== undefined && ` · ${fmtMoney(o.total)}`}
                      {o.salesName && user?.role === 'Manager' && ` · ${o.salesName}`}
                    </div>
                  </div>
                  <div className="space-y-1.5"><Badge>{o.status}</Badge><ProgressBar value={o.progress} /></div>
                  <div className="ff-mono text-xs text-muted-foreground md:text-right">{fmtDate(o.createdAt)}</div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
