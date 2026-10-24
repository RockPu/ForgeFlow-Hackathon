import { Link } from 'wouter';
import { getFactoryProductionQueryKey, useFactoryProduction } from '@workspace/api-client-react';
import { Badge, Empty, ErrorState, ExpectedNote, PageHead, ProgressBar, Skeleton, StageStrip } from '@/components/bits';
import { POLL } from '@/lib/factory';

export default function Production() {
  const q = useFactoryProduction({ query: { queryKey: getFactoryProductionQueryKey(), refetchInterval: POLL } });
  return (
    <>
      <PageHead kicker="Shared floor view · no commercial details" title="Production" />
      {q.isLoading && <Skeleton rows={4} />}
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.data?.length === 0 && <Empty title="Nothing in production" hint="Approved official orders show up here once they reach the factory." />}
      <div className="grid gap-4 md:grid-cols-2">
        {q.data?.map((o, i) => (
          <article key={o.id} className="ff-panel ff-up p-4" style={{ animationDelay: `${i * 50}ms` }} data-testid={`card-production-${o.id}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="ff-mono text-lg font-semibold">{o.officialNumber ?? o.number}</div>
                <div className="text-sm text-muted-foreground">{o.lines.map((l) => `${l.quantity} x ${l.productName}`).join(', ')}</div>
              </div>
              <Badge>{o.status}</Badge>
            </div>
            <div className="my-4 space-y-2"><ProgressBar value={o.progress} /><StageStrip order={o} /></div>
            <div className="flex items-center justify-between gap-2">
              <ExpectedNote date={o.expectedDispatch} />
              <Link href={`/traceability?search=${encodeURIComponent(o.officialNumber ?? o.number)}`} className="text-sm font-semibold text-primary hover:underline" data-testid={`link-trace-${o.id}`}>Trace</Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
