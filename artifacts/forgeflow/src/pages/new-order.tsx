import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { getFactoryCatalogQueryKey, useFactoryCatalog, useFactorySubmitOrder } from '@workspace/api-client-react';
import { ErrorState, Field, PageHead, Panel, Skeleton, Empty } from '@/components/bits';
import { errMsg, fmtMoney, invalidateFactory, useAuth } from '@/lib/factory';
import { useToast } from '@/hooks/use-toast';

interface Line { key: number; productId: string; quantity: string; unitPrice: string }
let k = 1;
const blank = (): Line => ({ key: k++, productId: '', quantity: '1', unitPrice: '' });

export default function NewOrder() {
  const { user, req } = useAuth();
  const qc = useQueryClient();
  const [, nav] = useLocation();
  const { toast } = useToast();
  const cat = useFactoryCatalog({ query: { queryKey: getFactoryCatalogQueryKey() } });
  const submit = useFactorySubmitOrder({ request: req });
  const [f, setF] = useState({ company: '', contact: '', deliveryDate: '', address: '', notes: '' });
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [serverErr, setServerErr] = useState('');
  const products = cat.data?.products ?? [];
  const total = useMemo(() => lines.reduce((n, l) => n + (Number(l.quantity) || 0) * Math.round((Number(l.unitPrice) || 0) * 100), 0) / 100, [lines]);

  if (user?.role !== 'Sales') return <><PageHead kicker="Intake" title="New order" /><Empty title="Sales only" hint="Only Sales staff can submit customer orders." action={<Link href="/orders" className="ff-btn ff-btn-line">Back to orders</Link>} /></>;

  const upd = (key: number, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const validate = () => {
    const e: Record<string, string> = {};
    if (f.company.trim().length < 2) e.company = 'Company must be at least 2 characters.';
    if (f.contact.trim().length < 5) e.contact = 'Contact must be at least 5 characters.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.deliveryDate)) e.deliveryDate = 'Choose a delivery date.';
    else if (f.deliveryDate < new Date().toISOString().slice(0, 10)) e.deliveryDate = 'Delivery date cannot be in the past.';
    if (f.address.trim().length < 5) e.address = 'Address must be at least 5 characters.';
    if (lines.length > 30) e.lines = 'At most 30 lines.';
    const selected = new Set<string>();
    lines.forEach((l) => {
      const q = Number(l.quantity), p = Number(l.unitPrice);
      if (!l.productId) e[`p${l.key}`] = 'Select a product.';
      else if (selected.has(l.productId)) e[`p${l.key}`] = 'Combine this product into one line.';
      selected.add(l.productId);
      if (!Number.isInteger(q) || q < 1 || q > 10000) e[`q${l.key}`] = 'Whole number, 1 to 10000.';
      if (!(p >= 0.01 && p <= 1000000)) e[`u${l.key}`] = 'Price 0.01 to 1,000,000.';
      else if (Math.abs(p * 100 - Math.round(p * 100)) >= 0.000001) e[`u${l.key}`] = 'Use at most two decimal places.';
    });
    return e;
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    setServerErr('');
    const e = validate();
    setErrs(e);
    if (Object.keys(e).length) return;
    submit.mutate(
      {
        data: {
          company: f.company.trim(), contact: f.contact.trim(), deliveryDate: f.deliveryDate, address: f.address.trim(),
          ...(f.notes.trim() ? { notes: f.notes.trim() } : {}),
          lines: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) })),
        },
      },
      {
        onSuccess: (o) => {
          toast({ title: 'Order submitted', description: `${o.number} is waiting for manager review.` });
          void invalidateFactory(qc);
          nav(`/orders/${o.id}`);
        },
        onError: (er) => setServerErr(errMsg(er)),
      },
    );
  };

  return (
    <>
      <PageHead kicker="Sales intake" title="New customer order" />
      {cat.isLoading && <Skeleton rows={5} />}
      {cat.isError && <ErrorState error={cat.error} retry={() => cat.refetch()} />}
      {cat.data && (
        <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[1fr_300px]" noValidate>
          <div className="space-y-5">
            <Panel title="Customer" kicker="01">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company" error={errs.company}><input className="ff-field" value={f.company} maxLength={200} onChange={(e) => setF({ ...f, company: e.target.value })} data-testid="input-company" /></Field>
                <Field label="Contact (name, email or phone)" error={errs.contact}><input className="ff-field" value={f.contact} maxLength={300} onChange={(e) => setF({ ...f, contact: e.target.value })} data-testid="input-contact" /></Field>
                <Field label="Requested delivery date" error={errs.deliveryDate}><input type="date" className="ff-field" value={f.deliveryDate} onChange={(e) => setF({ ...f, deliveryDate: e.target.value })} data-testid="input-delivery-date" /></Field>
                <Field label="Delivery address" error={errs.address}><input className="ff-field" value={f.address} maxLength={1000} onChange={(e) => setF({ ...f, address: e.target.value })} data-testid="input-address" /></Field>
              </div>
              <div className="mt-4"><Field label="Notes (optional)"><textarea className="ff-field min-h-20" maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} data-testid="input-notes" /></Field></div>
            </Panel>
            <Panel title="Products" kicker="02" right={<button type="button" className="ff-btn ff-btn-line" disabled={lines.length >= 30} onClick={() => setLines([...lines, blank()])} data-testid="button-add-line"><Plus className="h-3.5 w-3.5" /> Add line</button>}>
              {errs.lines && <p className="mb-2 text-sm text-destructive">{errs.lines}</p>}
              <div className="space-y-3">
                {lines.map((l, i) => (
                  <div key={l.key} className="ff-up grid gap-3 rounded-sm border bg-background/60 p-3 sm:grid-cols-[1fr_100px_120px_auto] sm:items-start" data-testid={`line-${i}`}>
                    <Field label={`Product ${i + 1}`} error={errs[`p${l.key}`]}>
                      <select className="ff-field" value={l.productId} onChange={(e) => { const p = products.find((x) => x.id === e.target.value); upd(l.key, { productId: e.target.value, unitPrice: p ? String(p.unitPrice) : l.unitPrice }); }} data-testid={`select-product-${i}`}>
                        <option value="">Select product</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </select>
                    </Field>
                    <Field label="Qty" error={errs[`q${l.key}`]}><input className="ff-field ff-mono" inputMode="numeric" value={l.quantity} onChange={(e) => upd(l.key, { quantity: e.target.value })} data-testid={`input-qty-${i}`} /></Field>
                    <Field label="Unit price" error={errs[`u${l.key}`]}><input className="ff-field ff-mono" inputMode="decimal" value={l.unitPrice} onChange={(e) => upd(l.key, { unitPrice: e.target.value })} data-testid={`input-price-${i}`} /></Field>
                    <button type="button" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines(lines.filter((x) => x.key !== l.key))} className="ff-btn ff-btn-line mt-5 !px-2.5" data-testid={`button-remove-line-${i}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <aside className="h-fit space-y-3 lg:sticky lg:top-6">
            <div className="ff-panel bg-[hsl(186_30%_12%)] p-4 text-[hsl(40_30%_94%)]">
              <div className="ff-label !text-[hsl(40_20%_70%)]">Order value</div>
              <div className="ff-mono mt-1 text-3xl font-semibold" data-testid="text-total">{fmtMoney(total)}</div>
              <div className="ff-mono text-xs opacity-70">{lines.length} line{lines.length === 1 ? '' : 's'}</div>
            </div>
            {serverErr && <div role="alert" className="border-l-4 border-l-destructive bg-[hsl(356_70%_94%)] px-3 py-2 text-sm text-destructive" data-testid="text-submit-error">{serverErr}</div>}
            <button className="ff-btn ff-btn-primary w-full !py-3" disabled={submit.isPending} data-testid="button-submit-order">{submit.isPending ? 'Submitting' : 'Submit for manager review'}</button>
            <p className="text-xs text-muted-foreground">Nothing is approved automatically. A manager reviews every order before it reaches the factory.</p>
          </aside>
        </form>
      )}
    </>
  );
}
