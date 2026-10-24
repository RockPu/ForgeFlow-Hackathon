import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getFactorySessionQueryKey, useFactoryLogin } from '@workspace/api-client-react';
import { Logo } from '@/components/shell';
import { Field, useTitle } from '@/components/bits';
import { errMsg, useAuth } from '@/lib/factory';
import { ArrowRight } from 'lucide-react';

const DEMOS = [
  { email: 'sales@forgeflow.demo', role: 'Sales', note: 'Owns and submits orders' },
  { email: 'sales2@forgeflow.demo', role: 'Sales (second)', note: 'Sees only its own orders' },
  { email: 'manager@forgeflow.demo', role: 'Manager', note: 'Approves and issues official numbers' },
  { email: 'operator@forgeflow.demo', role: 'Factory Operator', note: 'Runs stock, stages, dispatch' },
];

export default function Login() {
  useTitle('Sign in');
  const { csrf, req } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useFactoryLogin({ request: req });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (email.trim().length < 3 || !password) return setError('Enter your email and password.');
    login.mutate(
      { data: { email: email.trim(), password } },
      {
        onSuccess: (session) => qc.setQueryData(getFactorySessionQueryKey(), session),
        onError: (err) => setError(errMsg(err)),
      },
    );
  };

  return (
    <div className="grid min-h-[100dvh] md:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground md:flex">
        <Logo />
        <div className="ff-up">
          <div className="ff-label !text-primary">Batch ticket / FF-2026</div>
          <h1 className="mt-4 text-6xl font-extrabold leading-[0.95] tracking-tight text-[hsl(40_30%_94%)]">
            Every batch,<br />request to<br /><span className="text-primary">dispatch.</span>
          </h1>
          <p className="mt-6 max-w-md text-[15px] text-sidebar-foreground/80">
            One shared floor record for sales, managers and operators. Inspections, stock and shipping follow the batch, not the spreadsheet.
          </p>
          <div className="mt-8 flex gap-1.5">
            {['Cut', 'Form', 'Weld', 'Finish', 'QC', 'Pack'].map((s, i) => (
              <div key={s} className="flex-1">
                <div className={`h-2 rounded-[2px] ${i < 4 ? 'bg-primary' : 'bg-sidebar-border'}`} />
                <div className="ff-mono mt-1 text-[10px] uppercase tracking-widest opacity-60">{s}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="ff-hazard h-2 rounded-full opacity-80" />
      </section>

      <section className="flex flex-col justify-center px-6 py-10 md:px-14">
        <div className="mx-auto w-full max-w-md ff-up">
          <div className="md:hidden mb-8"><Logo dark={false} /></div>
          <div className="ff-label">Authorized staff</div>
          <h2 className="mb-6 mt-1 text-3xl font-extrabold">Sign in to the floor</h2>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field label="Email">
              <input className="ff-field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
            </Field>
            <Field label="Password">
              <input className="ff-field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-password" />
            </Field>
            {error && <div role="alert" className="border-l-4 border-l-destructive bg-[hsl(356_70%_94%)] px-3 py-2 text-sm text-destructive" data-testid="text-login-error">{error}</div>}
            <button className="ff-btn ff-btn-primary w-full !py-3" disabled={login.isPending || !csrf} data-testid="button-login">
              {login.isPending ? 'Signing in' : 'Sign in'} <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-8 border-t pt-5">
            <div className="ff-label mb-2">Demo accounts · password ForgeDemo!2026</div>
            <ul className="space-y-1.5">
              {DEMOS.map((d) => (
                <li key={d.email}>
                  <button type="button" onClick={() => { setEmail(d.email); setPassword('ForgeDemo!2026'); setError(''); }} className="group flex w-full items-center justify-between rounded-[4px] border px-3 py-2 text-left transition hover:border-primary hover:bg-card" data-testid={`button-demo-${d.email.split('@')[0]}`}>
                    <span>
                      <span className="ff-mono block text-xs">{d.email}</span>
                      <span className="text-xs text-muted-foreground">{d.role} · {d.note}</span>
                    </span>
                    <span className="ff-label opacity-0 transition group-hover:opacity-100">Fill</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Sample data for demonstration. Tap an account to fill the form, then sign in.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
