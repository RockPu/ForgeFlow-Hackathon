import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { getFactoryTraceabilityQueryKey, useFactoryTraceability } from '@workspace/api-client-react';
import { Badge, Empty, ErrorState, PageHead, Panel, Skeleton } from '@/components/bits';
import { TracePanel } from '@/components/trace';
import { POLL } from '@/lib/factory';

export default function Traceability() {
  const initial = useMemo(() => new URLSearchParams(window.location.search).get('search') ?? '', []);
  const [text, setText] = useState(initial);
  const [search, setSearch] = useState(initial.trim());
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const params = { search };
  const q = useFactoryTraceability(params, { query: { queryKey: getFactoryTraceabilityQueryKey(params), refetchInterval: POLL } });
  const sel = q.data?.find((o) => o.id === open) ?? (q.data?.length === 1 ? q.data[0] : undefined);
  return (
    <>
      <PageHead kicker="Safe shared view · no contact details or commercial terms" title="Traceability" />
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input className="ff-field !pl-9" placeholder="Search by order number, serial number, batch ID or customer" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} data-testid="input-trace-search" />
      </div>
      {q.isLoading && <Skeleton rows={4} />}
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.data?.length === 0 && <Empty title="No matching batch" hint="Check the order number or batch ID and try again." />}
      {q.data && q.data.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <ul className="ff-panel h-fit divide-y overflow-hidden">
            {q.data.map((o) => (
              <li key={o.id}>
                <button onClick={() => setOpen(o.id)} className={`ff-row w-full px-4 py-3 text-left ${sel?.id === o.id ? 'bg-muted' : ''}`} data-testid={`button-trace-${o.id}`}>
                  <div className="ff-mono text-sm font-semibold">{o.officialNumber ?? o.number}</div>
                  <div className="text-sm text-muted-foreground">{o.company}</div>
                  <div className="mt-1"><Badge>{o.status}</Badge></div>
                  <div className="ff-mono mt-1 truncate text-[11px] text-muted-foreground">{o.allocations.map((a) => a.batchId).join(', ') || 'No batches yet'}</div>
                </button>
              </li>
            ))}
          </ul>
          {sel ? (
            <Panel title={sel.officialNumber ?? sel.number} kicker={sel.company}><TracePanel order={sel} /></Panel>
          ) : <Empty title="Select an order" hint="Choose a result to see its batches, inspections and shipping." />}
        </div>
      )}
    </>
  );
}
