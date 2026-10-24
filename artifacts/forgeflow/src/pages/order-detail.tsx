import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import {
  getFactoryAuditQueryKey,
  getFactoryOrderQueryKey,
  useFactoryAudit,
  useFactoryCommand,
  useFactoryOrder,
  type FactoryCommandInput,
  type FactoryOrder,
} from '@workspace/api-client-react';
import { Badge, Empty, ErrorState, ExpectedNote, Field, PageHead, Panel, ProgressBar, Skeleton, StageStrip } from '@/components/bits';
import { TracePanel } from '@/components/trace';
import { POLL, errMsg, fmtDate, fmtMoney, invalidateFactory, useAuth } from '@/lib/factory';
import { useToast } from '@/hooks/use-toast';

type Run = (data: Omit<FactoryCommandInput, 'version'>, ok: string, done?: () => void) => void;

function Form({ title, hint, children, onSubmit, submit, pending, danger, disabled }: { title: string; hint?: string; children?: ReactNode; onSubmit: () => void; submit: string; pending: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="space-y-3 rounded-sm border bg-background/60 p-3" data-testid={`form-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <div><div className="text-sm font-bold">{title}</div>{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>
      {children}
      <button className={`ff-btn ${danger ? 'ff-btn-danger' : 'ff-btn-dark'}`} disabled={pending || disabled} data-testid={`button-${submit.toLowerCase().replace(/\s/g, '-')}`}>{pending ? 'Working' : submit}</button>
    </form>
  );
}
const ta = 'ff-field min-h-16';

function ManagerPanel({ o, run, pending }: { o: FactoryOrder; run: Run; pending: boolean }) {
  const [notes, setNotes] = useState('');
  const [review, setReview] = useState('');
  const [err, setErr] = useState('');
  const go = (action: 'approve' | 'reject') => {
    if (!notes.trim()) return setErr('A decision note is required.');
    setErr('');
    run({ action, notes: notes.trim(), ...(review.trim() ? { reviewNotes: review.trim() } : {}) }, action === 'approve' ? 'Order approved' : 'Order rejected');
  };
  return (
    <Panel title="Manager decision" kicker="Review required">
      <div className="space-y-3">
        <Field label="Decision note (required)" error={err}><textarea className={ta} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-decision-note" /></Field>
        <Field label="Review notes (optional)"><textarea className={ta} maxLength={2000} value={review} onChange={(e) => setReview(e.target.value)} data-testid="input-review-notes" /></Field>
        <div className="flex gap-2">
          <button className="ff-btn ff-btn-primary" disabled={pending} onClick={() => go('approve')} data-testid="button-approve">Approve</button>
          <button className="ff-btn ff-btn-danger" disabled={pending} onClick={() => go('reject')} data-testid="button-reject">Reject</button>
        </div>
      </div>
    </Panel>
  );
}

function OperatorPanel({ o, run, pending }: { o: FactoryOrder; run: Run; pending: boolean }) {
  const prodQty = o.allocations.filter((a) => a.source === 'Production').reduce((n, a) => n + a.quantity, 0);
  const nextStage = o.stages.find((s) => s.status !== 'Passed');
  const openIssues = o.issues.filter((i) => !i.resolvedAt);
  const stockPending = o.allocations.some((a) => a.source === 'Finished Stock' && !a.released);
  const canInventory = /queue|waiting for materials/i.test(o.status);
  const shortages = o.procurement.filter((p) => p.status === 'Open' && p.received < p.quantity);

  const [rec, setRec] = useState<Record<string, { q: string; n: string }>>({});
  const [st, setSt] = useState({ status: 'In Progress', quantity: String(prodQty || ''), measurements: '', notes: '' });
  const [res, setRes] = useState<Record<string, string>>({});
  const [rel, setRel] = useState({ measurements: '', notes: '' });
  const [ship, setShip] = useState({ carrier: '', tracking: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const setE = (k: string, v: string) => setErr((e) => ({ ...e, [k]: v }));

  const inspections = o.stages.length;
  const completed = o.stages.filter((s) => s.status === 'Passed').length;

  return (
    <Panel title="Operator actions" kicker="Factory floor" right={<span className="ff-mono text-xs text-muted-foreground" data-testid="text-inspection-counts">{inspections - completed} pending / {completed} completed inspections</span>}>
      <div className="grid gap-3 lg:grid-cols-2">
        {canInventory && (
          <Form title="Check inventory" hint="Reserves stock and raises procurement for shortages. Reserved stock is retained; no split shipments." submit="Check inventory" pending={pending} onSubmit={() => run({ action: 'check-inventory' }, 'Inventory checked')} />
        )}

        {shortages.map((p) => {
          const v = rec[p.id] ?? { q: '', n: '' };
          const set = (x: Partial<typeof v>) => setRec({ ...rec, [p.id]: { ...v, ...x } });
          return (
            <Form key={p.id} title={`Receive ${p.materialName}`} hint={`Shortage: ${p.quantity - p.received} outstanding of ${p.quantity} (${p.status}).`} submit="Receive material" pending={pending}
              onSubmit={() => {
                const q = Number(v.q);
                if (!(q > 0)) return setE(p.id, 'Enter a positive quantity.');
                if (!v.n.trim()) return setE(p.id, 'Receipt reference is required.');
                setE(p.id, '');
                run({ action: 'receive-material', procurementId: p.id, quantity: q, notes: v.n.trim() }, 'Material received', () => setRec({ ...rec, [p.id]: { q: '', n: '' } }));
              }}>
              <div className="grid gap-2 sm:grid-cols-[100px_1fr]">
                <input className="ff-field ff-mono" inputMode="decimal" placeholder="Qty" value={v.q} onChange={(e) => set({ q: e.target.value })} data-testid={`input-receive-qty-${p.id}`} />
                <input className="ff-field" placeholder="Receipt reference" value={v.n} onChange={(e) => set({ n: e.target.value })} data-testid={`input-receive-ref-${p.id}`} />
              </div>
              {err[p.id] && <p className="text-xs text-destructive" role="alert">{err[p.id]}</p>}
            </Form>
          );
        })}

        {prodQty > 0 && nextStage && openIssues.length === 0 && (
          <Form title={`Stage ${nextStage.index + 1}: ${nextStage.name}`} hint={`Sequential workflow. Quantity is the total production allocation (${prodQty}).`} submit="Record inspection" pending={pending}
            onSubmit={() => {
              const q = Number(st.quantity);
              if (!(q > 0)) return setE('stage', 'Quantity must be positive.');
              if (!st.measurements.trim()) return setE('stage', 'Checklist / measurement results are required.');
              if (st.status === 'Failed' && !st.notes.trim()) return setE('stage', 'Notes are required for a failure.');
              setE('stage', '');
              run({ action: 'stage', stageIndex: nextStage.index, status: st.status as 'In Progress', quantity: q, measurements: st.measurements.trim(), ...(st.notes.trim() ? { notes: st.notes.trim() } : {}) }, `${nextStage.name}: ${st.status}`, () => setSt({ ...st, measurements: '', notes: '' }));
            }}>
            <div className="grid gap-2 sm:grid-cols-2">
              <select className="ff-field" value={st.status} onChange={(e) => setSt({ ...st, status: e.target.value })} data-testid="select-stage-status">
                <option>In Progress</option><option>Passed</option><option>Failed</option>
              </select>
              <input className="ff-field ff-mono" inputMode="numeric" value={st.quantity} onChange={(e) => setSt({ ...st, quantity: e.target.value })} data-testid="input-stage-qty" />
            </div>
            <textarea className={ta} placeholder="Checklist and measurement results" maxLength={2000} value={st.measurements} onChange={(e) => setSt({ ...st, measurements: e.target.value })} data-testid="input-stage-measurements" />
            <textarea className={ta} placeholder={st.status === 'Failed' ? 'Failure notes (required)' : 'Notes (optional)'} maxLength={2000} value={st.notes} onChange={(e) => setSt({ ...st, notes: e.target.value })} data-testid="input-stage-notes" />
            {err.stage && <p className="text-xs text-destructive" role="alert">{err.stage}</p>}
          </Form>
        )}

        {openIssues.map((i) => (
          <Form key={i.id} title={`Resolve issue: ${o.stages[i.stageIndex]?.name ?? 'stage'}`} hint={i.notes} submit="Resolve issue" pending={pending}
            onSubmit={() => {
              if (!(res[i.id] ?? '').trim()) return setE(i.id, 'Describe the resolution.');
              setE(i.id, '');
              run({ action: 'resolve-issue', issueId: i.id, notes: res[i.id].trim() }, 'Issue resolved. Re-inspect the stage.');
            }}>
            <textarea className={ta} placeholder="Resolution notes" maxLength={2000} value={res[i.id] ?? ''} onChange={(e) => setRes({ ...res, [i.id]: e.target.value })} data-testid={`input-resolve-${i.id}`} />
            {err[i.id] && <p className="text-xs text-destructive" role="alert">{err[i.id]}</p>}
          </Form>
        ))}

        {stockPending && (
          <Form title="Release finished stock" hint="Releases all finished-stock allocations and records a readiness check." submit="Release stock" pending={pending}
            onSubmit={() => {
              if (!rel.measurements.trim() || !rel.notes.trim()) return setE('rel', 'Checklist and notes are both required.');
              setE('rel', '');
              run({ action: 'release-stock', measurements: rel.measurements.trim(), notes: rel.notes.trim() }, 'Stock released', () => setRel({ measurements: '', notes: '' }));
            }}>
            <textarea className={ta} placeholder="Readiness checklist" maxLength={2000} value={rel.measurements} onChange={(e) => setRel({ ...rel, measurements: e.target.value })} data-testid="input-release-checklist" />
            <textarea className={ta} placeholder="Notes" maxLength={2000} value={rel.notes} onChange={(e) => setRel({ ...rel, notes: e.target.value })} data-testid="input-release-notes" />
            {err.rel && <p className="text-xs text-destructive" role="alert">{err.rel}</p>}
          </Form>
        )}

        {!o.shipment && (
          <Form title="Dispatch" hint="Requires all quantities allocated and released, all six stages passed and no open issues." submit="Dispatch order" pending={pending}
            onSubmit={() => {
              if (!ship.carrier.trim() || !ship.tracking.trim()) return setE('ship', 'Carrier and tracking are required.');
              setE('ship', '');
              run({ action: 'dispatch', carrier: ship.carrier.trim(), tracking: ship.tracking.trim() }, 'Order dispatched');
            }}>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="ff-field" placeholder="Carrier" maxLength={200} value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} data-testid="input-carrier" />
              <input className="ff-field ff-mono" placeholder="Tracking" maxLength={200} value={ship.tracking} onChange={(e) => setShip({ ...ship, tracking: e.target.value })} data-testid="input-tracking" />
            </div>
            {err.ship && <p className="text-xs text-destructive" role="alert">{err.ship}</p>}
          </Form>
        )}
      </div>
    </Panel>
  );
}

function AuditPanel({ id }: { id: string }) {
  const q = useFactoryAudit(id, { query: { queryKey: getFactoryAuditQueryKey(id), refetchInterval: POLL } });
  return (
    <Panel title="Audit trail" kicker="Who changed what">
      {q.isLoading && <Skeleton rows={2} />}
      {q.isError && <ErrorState error={q.error} retry={() => q.refetch()} />}
      {q.data?.length === 0 && <p className="text-sm text-muted-foreground">No audit events.</p>}
      <ol className="space-y-3">
        {q.data?.map((e) => (
          <li key={e.id} className="border-l-2 border-primary pl-3" data-testid={`audit-${e.id}`}>
            <div className="text-sm"><b>{e.action}</b> <span className="text-muted-foreground">by {e.actor}</span></div>
            <div className="ff-mono text-[11px] text-muted-foreground">{fmtDate(e.at, true)}</div>
            <details className="mt-1 text-xs">
              <summary className="cursor-pointer text-primary">Before / after</summary>
              <pre className="ff-mono mt-1 overflow-x-auto whitespace-pre-wrap rounded-sm bg-muted p-2 text-[11px]">{JSON.stringify({ before: e.before, after: e.after }, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export default function OrderDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { user, req } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useFactoryOrder(id, { query: { queryKey: getFactoryOrderQueryKey(id), refetchInterval: POLL, retry: false } });
  const cmd = useFactoryCommand({ request: req });
  const [actionErr, setActionErr] = useState('');
  const o = q.data;
  const role = user?.role;

  const run: Run = (data, ok, done) => {
    if (!o) return;
    setActionErr('');
    cmd.mutate({ id, data: { ...data, version: o.version } }, {
      onSuccess: (next) => {
        qc.setQueryData(getFactoryOrderQueryKey(id), next);
        void invalidateFactory(qc);
        toast({ title: ok });
        done?.();
      },
      onError: (e) => { setActionErr(errMsg(e)); void qc.invalidateQueries({ queryKey: getFactoryOrderQueryKey(id) }); },
    });
  };

  const back = <Link href="/orders" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="link-back"><ArrowLeft className="h-4 w-4" /> Orders</Link>;
  if (q.isLoading) return <>{back}<Skeleton rows={5} /></>;
  if (q.isError || !o) return <>{back}<ErrorState error={q.error} retry={() => q.refetch()} /></>;

  const official = !!o.officialNumber;
  const ownsSales = role === 'Sales' && !!o.salesName && o.salesName === user?.name;
  const canAudit = role === 'Manager' || ownsSales;

  return (
    <>
      {back}
      <PageHead kicker={`Ref ${o.number} · v${o.version}`} title={o.officialNumber ?? o.number}>
        <div className="flex items-center gap-2"><Badge>{o.status}</Badge><Badge>{o.decision}</Badge></div>
      </PageHead>

      {actionErr && <div role="alert" className="mb-4 border-l-4 border-l-destructive bg-[hsl(356_70%_94%)] px-4 py-3 text-sm text-destructive" data-testid="text-action-error">{actionErr}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Panel title={o.company} kicker="Order summary">
            <div className="mb-4 space-y-2"><ProgressBar value={o.progress} /><StageStrip order={o} /><ExpectedNote date={o.expectedDispatch} /></div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="ff-label">Delivery date</dt><dd>{o.deliveryDate}</dd></div>
              <div><dt className="ff-label">Created</dt><dd>{fmtDate(o.createdAt, true)}</dd></div>
              {o.contact && <div><dt className="ff-label">Contact</dt><dd>{o.contact}</dd></div>}
              {o.address && <div><dt className="ff-label">Address</dt><dd>{o.address}</dd></div>}
              {o.salesName && <div><dt className="ff-label">Sales owner</dt><dd>{o.salesName}</dd></div>}
              {o.total !== undefined && <div><dt className="ff-label">Total</dt><dd className="ff-mono">{fmtMoney(o.total)}</dd></div>}
              {o.notes && <div className="sm:col-span-2"><dt className="ff-label">Notes</dt><dd className="whitespace-pre-wrap">{o.notes}</dd></div>}
            </dl>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-lines">
                <thead><tr className="ff-label text-left"><th className="py-1">Product</th><th className="text-right">Qty</th>{role !== 'Factory Operator' && <><th className="text-right">Unit</th><th className="text-right">Total</th></>}</tr></thead>
                <tbody>
                  {o.lines.map((l) => (
                    <tr key={l.id} className="border-t"><td className="py-2">{l.productName}</td><td className="ff-mono text-right">{l.quantity}</td>{role !== 'Factory Operator' && <><td className="ff-mono text-right">{fmtMoney(l.unitPrice)}</td><td className="ff-mono text-right">{fmtMoney(l.total)}</td></>}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {(o.decisionNote || o.decidedBy) && (
            <Panel title="Manager decision" kicker={o.decision}>
              <p className="text-sm">{o.decisionNote}</p>
              {o.reviewNotes && <p className="mt-2 text-sm text-muted-foreground">Review notes: {o.reviewNotes}</p>}
              <p className="ff-mono mt-2 text-xs text-muted-foreground">{o.decidedBy} · {fmtDate(o.decidedAt, true)}</p>
              {official && <p className="ff-mono mt-1 text-xs text-muted-foreground">Official number issued by {o.officialCreatedBy} · {fmtDate(o.officialCreatedAt, true)}</p>}
            </Panel>
          )}

          {role === 'Manager' && o.decision === 'Pending Manager Review' && <ManagerPanel o={o} run={run} pending={cmd.isPending} />}
          {role === 'Manager' && o.decision === 'Approved' && !official && (
            <Panel title="Official order" kicker="Approved">
              <p className="mb-3 text-sm text-muted-foreground">Create the official order number to release this order to the factory queue.</p>
              <button className="ff-btn ff-btn-primary" disabled={cmd.isPending} onClick={() => run({ action: 'official' }, 'Official order created')} data-testid="button-official">{cmd.isPending ? 'Working' : 'Create official order'}</button>
            </Panel>
          )}
          {role === 'Factory Operator' && official && !o.shipment && <OperatorPanel o={o} run={run} pending={cmd.isPending} />}
          {role === 'Factory Operator' && !official && <Empty title="Not an official order" hint="Operators can act on an order once a manager has issued its official number." />}

          {o.procurement.length > 0 && (
            <Panel title="Procurement" kicker="Materials">
              <ul className="divide-y">
                {o.procurement.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm" data-testid={`procurement-${p.id}`}>
                    <span>{p.materialName}</span>
                    <span className="flex items-center gap-3"><span className="ff-mono">{p.received} / {p.quantity}</span><Badge>{p.status}</Badge></span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Batch trace" kicker="Allocations, inspections, shipping"><TracePanel order={o} /></Panel>
        </div>

        <div className="space-y-5">
          {o.risk && (
            <Panel title={`Risk: ${o.risk.level}`} kicker="Advisory only">
              <div data-testid="panel-risk" className="space-y-2 text-sm">
                <p className="ff-mono rounded-sm bg-[hsl(43_85%_84%)] px-2 py-1 text-xs text-[hsl(35_80%_22%)]">Deterministic demo assessment. All sources are sample and unverified. Advisory only; it never approves or rejects.</p>
                <p>{o.risk.explanation}</p>
                <div className="ff-mono text-xs">Rule confidence {Math.round(o.risk.confidence <= 1 ? o.risk.confidence * 100 : o.risk.confidence)}% · {o.risk.label}</div>
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">{o.risk.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            </Panel>
          )}
          {canAudit && <AuditPanel id={id} />}
        </div>
      </div>
    </>
  );
}
