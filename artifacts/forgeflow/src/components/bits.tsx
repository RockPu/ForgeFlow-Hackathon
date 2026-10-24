import { useEffect, type ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { errMsg, statusTone, toneClass, type Tone } from '@/lib/factory';
import type { FactoryOrder } from '@workspace/api-client-react';

export function useTitle(t: string) {
  useEffect(() => {
    document.title = `${t} · ForgeFlow`;
  }, [t]);
}

export function Badge({ children, tone }: { children: ReactNode; tone?: Tone }) {
  const t = tone ?? (typeof children === 'string' ? statusTone(children) : 'idle');
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2 py-0.5 ff-mono text-[11px] font-medium ${toneClass[t]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function PageHead({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  useTitle(title);
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 ff-up">
      <div>
        <div className="ff-label">{kicker}</div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, kicker, children, right, className = '' }: { title?: string; kicker?: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`ff-panel ff-up ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div>
            {kicker && <div className="ff-label">{kicker}</div>}
            <h2 className="text-base font-bold">{title}</h2>
          </div>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" data-testid="loading-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="ff-skel h-14" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="ff-panel flex flex-col items-start gap-3 border-l-4 border-l-destructive p-5" role="alert" data-testid="state-error">
      <div className="flex items-center gap-2 font-bold text-destructive">
        <AlertTriangle className="h-4 w-4" /> Could not load this view
      </div>
      <p className="text-sm text-muted-foreground">{errMsg(error)}</p>
      {retry && (
        <button className="ff-btn ff-btn-line" onClick={retry} data-testid="button-retry">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="ff-panel flex flex-col items-center gap-2 px-6 py-12 text-center" data-testid="state-empty">
      <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-muted">
        <Inbox className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="font-bold">{title}</div>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="ff-label">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-destructive" role="alert">{error}</span>}
    </label>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2" data-testid="progress-bar">
      <div className="h-2 flex-1 overflow-hidden rounded-sm bg-muted">
        <div className="h-full origin-left bg-primary transition-transform duration-700" style={{ transform: `scaleX(${v / 100})` }} />
      </div>
      <span className="ff-mono w-9 text-right text-xs">{Math.round(v)}%</span>
    </div>
  );
}

export function StageStrip({ order }: { order: FactoryOrder }) {
  return (
    <div className="flex gap-1" aria-label="Stage progress">
      {order.stages.map((s) => {
        const c =
          s.status === 'Passed' ? 'bg-[hsl(150_35%_36%)]' : s.status === 'Failed' ? 'bg-destructive' : s.status === 'In Progress' ? 'bg-primary ff-pulse' : 'bg-border';
        return <div key={s.index} title={`${s.name}: ${s.status}`} className={`h-2.5 flex-1 rounded-[2px] ${c}`} />;
      })}
    </div>
  );
}

export function ExpectedNote({ date }: { date?: string }) {
  return <span className="ff-mono text-xs">Estimated {date ? date : 'not yet scheduled'} (estimate only)</span>;
}
