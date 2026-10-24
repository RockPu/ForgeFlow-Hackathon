import { getFactoryInventoryQueryKey, useFactoryInventory } from '@workspace/api-client-react';
import { Badge, Empty, ErrorState, PageHead, Panel, Skeleton } from '@/components/bits';
import { POLL, useAuth } from '@/lib/factory';

export default function Inventory() {
  const { user } = useAuth();
  const ok = user?.role === 'Factory Operator';
  const q = useFactoryInventory({ query: { queryKey: getFactoryInventoryQueryKey(), refetchInterval: POLL, enabled: ok } });
  if (!ok) return <><PageHead kicker="Operator" title="Inventory" /><Empty title="Operators only" hint="Stock and material levels are visible to Factory Operators." /></>;
  return (
    <>
      <PageHead kicker="Stock and raw materials" title="Inventory" />
      {q.isLoading && <Skeleton rows={5} />}
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.data && (
        <div className="space-y-5">
          <p className="ff-panel border-l-4 border-l-accent px-4 py-3 text-sm" data-testid="text-policy">{q.data.policy}</p>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Materials" kicker="Raw">
              {q.data.materials.length === 0 ? <Empty title="No materials recorded" /> : (
                <ul className="-m-4 divide-y">
                  {q.data.materials.map((m) => (
                    <li key={m.id} className="ff-row flex items-center justify-between px-4 py-3" data-testid={`row-material-${m.id}`}>
                      <div><div className="text-sm font-semibold">{m.name}</div><div className="ff-mono text-[11px] text-muted-foreground">{m.id}</div></div>
                      <div className="ff-mono text-lg">{m.available} <span className="text-xs text-muted-foreground">{m.unit}</span></div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="Finished stock" kicker="By batch">
              {q.data.stock.length === 0 ? <Empty title="No finished stock" /> : (
                <ul className="-m-4 divide-y">
                  {q.data.stock.map((s) => (
                    <li key={s.batchId} className="ff-row flex items-center justify-between gap-2 px-4 py-3" data-testid={`row-stock-${s.batchId}`}>
                      <div><div className="text-sm font-semibold">{s.productName}</div><div className="ff-mono text-[11px] text-muted-foreground">{s.batchId}</div></div>
                      <div className="flex items-center gap-3"><Badge>{s.quality}</Badge><span className="ff-mono text-lg">{s.available}</span></div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
