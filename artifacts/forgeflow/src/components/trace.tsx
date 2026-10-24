import type { FactoryAttempt, FactoryOrder } from '@workspace/api-client-react';
import { Badge, ExpectedNote, ProgressBar } from '@/components/bits';
import { fmtDate } from '@/lib/factory';
import { Truck, Wrench, Layers, AlertOctagon } from 'lucide-react';

function Attempt({ a }: { a: FactoryAttempt }) {
  return (
    <li className="border-l-2 border-border pl-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{a.status}</Badge>
        <span className="ff-mono text-xs text-muted-foreground">
          {fmtDate(a.startedAt, true)}
          {a.completedAt ? ` to ${fmtDate(a.completedAt, true)}` : ' (open)'} · {a.actor} · qty {a.quantity}
        </span>
      </div>
      {a.measurements && <p className="mt-1 whitespace-pre-wrap text-xs"><b>Measurements:</b> {a.measurements}</p>}
      {a.notes && <p className="whitespace-pre-wrap text-xs text-muted-foreground"><b>Notes:</b> {a.notes}</p>}
    </li>
  );
}

export function TracePanel({ order }: { order: FactoryOrder }) {
  const totalQty = order.lines.reduce((n, l) => n + l.quantity, 0);
  return (
    <div className="space-y-5" data-testid={`trace-${order.id}`}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><div className="ff-label">Status</div><Badge>{order.status}</Badge></div>
        <div><div className="ff-label">Progress</div><ProgressBar value={order.progress} /></div>
        <div><div className="ff-label">Dispatch</div><ExpectedNote date={order.expectedDispatch} /></div>
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Layers className="h-4 w-4" /> Batch identities ({totalQty} units ordered)</h3>
        {order.allocations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No batch allocated yet. Batches appear once inventory is checked.</p>
        ) : (
          <div className="space-y-2">
            {order.allocations.map((a) => (
              <div key={a.id} className="rounded-sm border bg-background/60 p-3" data-testid={`allocation-${a.id}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="ff-mono rounded-sm bg-[hsl(186_30%_12%)] px-2 py-0.5 text-xs text-[hsl(40_30%_94%)]">{a.batchId}</span>
                  <span className="text-sm font-semibold">{a.productName}</span>
                  <span className="ff-mono text-xs">qty {a.quantity}</span>
                  <Badge tone="info">{a.source}</Badge>
                  <Badge tone={a.released ? 'good' : 'warn'}>{a.released ? 'Quality released' : 'Not released'}</Badge>
                </div>
                {!!a.serialNumbers?.length && (
                  <div className="mt-2 text-xs">
                    <b>Individual serial numbers:</b>
                    <ul className="ff-mono mt-1 space-y-1 break-all">{a.serialNumbers.map(serial => <li key={serial}>{serial}</li>)}</ul>
                  </div>
                )}
                {a.history.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    <li className="ff-label">Release / readiness history</li>
                    {a.history.map((h) => <Attempt key={h.id} a={h} />)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Wrench className="h-4 w-4" /> Stage inspections</h3>
        <div className="space-y-2">
          {order.stages.map((s) => (
            <details key={s.index} className="rounded-sm border bg-background/60 p-3" open={s.status === 'Failed' || s.status === 'In Progress'}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="ff-mono text-xs text-muted-foreground">0{s.index + 1}</span>
                <span className="text-sm font-semibold">{s.name}</span>
                <Badge>{s.status}</Badge>
                <span className="ff-mono text-xs text-muted-foreground">{s.attempts.length} attempt{s.attempts.length === 1 ? '' : 's'}</span>
              </summary>
              {s.attempts.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No inspection recorded.</p>
              ) : (
                <ul className="mt-3 space-y-3">{s.attempts.map((a) => <Attempt key={a.id} a={a} />)}</ul>
              )}
            </details>
          ))}
        </div>
      </div>

      {order.issues.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><AlertOctagon className="h-4 w-4" /> Failure history</h3>
          <ul className="space-y-2">
            {order.issues.map((i) => (
              <li key={i.id} className="rounded-sm border-l-4 border-l-destructive bg-background/60 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={i.resolvedAt ? 'good' : 'bad'}>{i.resolvedAt ? 'Resolved' : 'Unresolved'}</Badge>
                  <span className="font-semibold">{order.stages[i.stageIndex]?.name ?? `Stage ${i.stageIndex + 1}`}</span>
                  <span className="ff-mono text-xs text-muted-foreground">{fmtDate(i.createdAt, true)} · {i.actor}</span>
                </div>
                <p className="mt-1 text-xs">{i.notes}</p>
                {i.resolution && (
                  <p className="mt-1 text-xs text-muted-foreground">Resolution: {i.resolution} ({i.resolvedBy}, {fmtDate(i.resolvedAt, true)})</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><Truck className="h-4 w-4" /> Shipping</h3>
        {order.shipment ? (
          <div className="rounded-sm border bg-background/60 p-3 text-sm" data-testid="shipment">
            <b>{order.shipment.carrier}</b> <span className="ff-mono">{order.shipment.tracking}</span>
            <div className="ff-mono text-xs text-muted-foreground">Dispatched {fmtDate(order.shipment.dispatchedAt, true)} by {order.shipment.actor}</div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not dispatched yet.</p>
        )}
      </div>
    </div>
  );
}
