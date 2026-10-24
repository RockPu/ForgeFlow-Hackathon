import { Link } from 'wouter';
import { getFactoryDashboardQueryKey, useFactoryDashboard } from '@workspace/api-client-react';
import { Badge, Empty, ErrorState, PageHead, Panel, Skeleton } from '@/components/bits';
import { POLL, fmtDate, useAuth } from '@/lib/factory';
import DashboardWorkflow from './dashboard-workflow';

export default function Dashboard() {
  const { user } = useAuth();
  const q = useFactoryDashboard({ query: { queryKey: getFactoryDashboardQueryKey(), refetchInterval: POLL } });
  const d = q.data;
  const tiles = d
    ? [
        { k: 'Total orders', v: d.total, c: 'bg-card' },
        { k: 'Pending review', v: d.pending, c: 'bg-[hsl(43_85%_84%)]' },
        { k: 'In production', v: d.active, c: 'bg-[hsl(186_35%_86%)]' },
        { k: 'Blocked', v: d.blocked, c: 'bg-[hsl(356_70%_90%)]' },
        { k: 'Dispatched', v: d.dispatched, c: 'bg-[hsl(150_35%_85%)]' },
      ]
    : [];
  return (
    <>
      <PageHead kicker={`${user?.role} · live, refreshes every 15 s`} title={`Welcome, ${user?.name.split(' ')[0]}`}>
        {user?.role === 'Sales' && <Link href="/orders/new" className="ff-btn ff-btn-primary" data-testid="link-new-order">New order</Link>}
      </PageHead>
      {q.isLoading && <Skeleton rows={5} />}
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {d && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            {tiles.map((t, i) => (
              <div key={t.k} className={`ff-panel ff-up p-4 ${t.c}`} style={{ animationDelay: `${i * 60}ms` }} data-testid={`tile-${t.k.toLowerCase().replace(/\s/g, '-')}`}>
                <div className="ff-label">{t.k}</div>
                <div className="ff-mono mt-2 text-4xl font-semibold">{t.v}</div>
              </div>
            ))}
          </div>
          <Panel title="Recent activity" kicker="Latest batch movement">
            {d.recent.length === 0 ? (
              <Empty title="Nothing on the floor yet" hint="Activity appears here as orders are submitted and move through production." />
            ) : (
              <ul className="-m-4 divide-y">
                {d.recent.map((r, i) => (
                  <li key={`${r.orderId}-${i}`}>
                    <Link href={`/orders/${r.orderId}`} className="ff-row flex flex-wrap items-center justify-between gap-2 px-4 py-3" data-testid={`row-activity-${r.orderId}`}>
                      <div>
                        <span className="ff-mono text-sm font-semibold">{r.number}</span>
                        <span className="ml-3 text-sm">{r.company}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge>{r.status}</Badge>
                        <span className="ff-mono text-xs text-muted-foreground">{fmtDate(r.at, true)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
      <DashboardWorkflow />
    </>
  );
}
