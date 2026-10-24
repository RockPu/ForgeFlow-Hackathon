import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { Boxes, ClipboardList, Factory, LayoutDashboard, LogOut, PlusSquare, ScanSearch } from 'lucide-react';
import { getFactorySessionQueryKey, useFactoryLogout } from '@workspace/api-client-react';
import { useAuth } from '@/lib/factory';
import { useToast } from '@/hooks/use-toast';

export function Logo({ dark = true }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-primary">
        <span className="text-lg font-extrabold leading-none text-white">F</span>
      </div>
      <div className={`text-lg font-extrabold tracking-tight ${dark ? 'text-[hsl(40_30%_94%)]' : ''}`}>ForgeFlow</div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [loc] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { req } = useAuth();
  const logout = useFactoryLogout({ request: req });
  const nav = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { href: '/orders', label: user?.role === 'Factory Operator' ? 'Factory orders' : 'Orders', icon: ClipboardList, show: true },
    { href: '/orders/new', label: 'New order', icon: PlusSquare, show: user?.role === 'Sales' },
    { href: '/production', label: 'Production', icon: Factory, show: true },
    { href: '/inventory', label: 'Inventory', icon: Boxes, show: user?.role === 'Factory Operator' },
    { href: '/traceability', label: 'Traceability', icon: ScanSearch, show: true },
  ].filter((n) => n.show);
  const active = (h: string) => (h === '/' ? loc === '/' : h === '/orders' ? loc === '/orders' || (loc.startsWith('/orders/') && loc !== '/orders/new') : loc.startsWith(h));

  const doLogout = () =>
    logout.mutate(undefined, {
      onSuccess: () => {
        qc.setQueryData(getFactorySessionQueryKey(), { user: null, csrfToken: req.headers['x-factory-csrf'] });
        void qc.invalidateQueries({ queryKey: getFactorySessionQueryKey() });
      },
      onError: (e) => toast({ title: 'Sign out failed', description: e.message, variant: 'destructive' }),
    });

  return (
    <div className="min-h-[100dvh] md:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <Logo />
        <div className="ff-hazard mt-4 h-1.5 rounded-full opacity-80" />
        <nav className="mt-6 flex-1 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              data-testid={`link-nav-${n.label.toLowerCase().replace(/\s/g, '-')}`}
              className={`group flex items-center gap-3 rounded-[4px] px-3 py-2.5 text-sm font-medium transition-all ${
                active(n.href) ? 'bg-sidebar-accent text-white shadow-[inset_3px_0_0_hsl(var(--sidebar-primary))]' : 'hover:translate-x-0.5 hover:bg-sidebar-accent/60'
              }`}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="rounded-[4px] border border-sidebar-border p-3">
          <div className="text-sm font-semibold text-white" data-testid="text-user-name">{user?.name}</div>
          <div className="ff-mono text-[11px] text-sidebar-foreground/70">{user?.role}</div>
          <button onClick={doLogout} disabled={logout.isPending} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[4px] border border-sidebar-border py-1.5 text-xs font-semibold transition hover:bg-sidebar-accent" data-testid="button-logout">
            <LogOut className="h-3.5 w-3.5" /> {logout.isPending ? 'Signing out' : 'Sign out'}
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between bg-sidebar px-4 py-3 md:hidden">
        <Logo />
        <div className="flex items-center gap-3">
          <span className="ff-mono text-[11px] text-sidebar-foreground/80">{user?.role}</span>
          <button onClick={doLogout} aria-label="Sign out" className="text-sidebar-foreground" data-testid="button-logout-mobile"><LogOut className="h-4 w-4" /></button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto bg-sidebar md:hidden">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className={`flex min-w-[72px] flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-semibold ${active(n.href) ? 'text-primary shadow-[inset_0_2px_0_hsl(var(--primary))]' : 'text-sidebar-foreground'}`}>
            <n.icon className="h-4 w-4" /> {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
