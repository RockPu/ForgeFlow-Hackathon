import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  getFactorySessionQueryKey,
  useFactorySession,
  type FactoryUser,
} from '@workspace/api-client-react';
import { format } from 'date-fns';

interface AuthValue {
  user: FactoryUser | null;
  csrf: string;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
  /** request options carrying CSRF header for every mutation */
  req: { headers: Record<string, string> };
}
const AuthCtx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const q = useFactorySession({
    query: { queryKey: getFactorySessionQueryKey(), retry: false, refetchOnWindowFocus: true },
  });
  const uid = q.data ? (q.data.user?.id ?? null) : undefined;
  const prev = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (uid === undefined) return;
    if (prev.current !== undefined && prev.current !== uid) {
      qc.removeQueries({ predicate: (x) => x.queryKey[0] !== getFactorySessionQueryKey()[0] });
    }
    prev.current = uid;
  }, [uid, qc]);
  const csrf = q.data?.csrfToken ?? '';
  const value: AuthValue = {
    user: q.data?.user ?? null,
    csrf,
    isLoading: q.isLoading,
    error: q.error,
    refetch: () => void q.refetch(),
    req: { headers: { 'x-factory-csrf': csrf } },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}

export function invalidateFactory(qc: QueryClient) {
  return qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).startsWith('/api/factory') });
}

export function errMsg(e: unknown): string {
  const d = (e as { data?: { message?: string; error?: string } })?.data;
  if (d && typeof d === 'object' && (d.message || d.error)) return String(d.message || d.error);
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}

export const POLL = 15000;

export function fmtDate(v?: string, withTime = false) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return format(d, withTime ? 'd MMM yyyy, HH:mm' : 'd MMM yyyy');
}
export function fmtMoney(n?: number) {
  if (n === undefined || n === null) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export type Tone = 'warn' | 'bad' | 'good' | 'info' | 'idle';
export function statusTone(s: string): Tone {
  if (/block|fail|reject|issue|hold/i.test(s)) return 'bad';
  if (/dispatched|complete|passed|released/i.test(s)) return 'good';
  if (/pending|waiting|review|not started/i.test(s)) return 'warn';
  if (/progress|production|queue|ready|approved|inspect/i.test(s)) return 'info';
  return 'idle';
}
export const toneClass: Record<Tone, string> = {
  warn: 'bg-[hsl(43_85%_84%)] text-[hsl(35_80%_22%)] border-[hsl(40_70%_55%)]',
  bad: 'bg-[hsl(356_70%_90%)] text-[hsl(356_66%_32%)] border-[hsl(356_55%_60%)]',
  good: 'bg-[hsl(150_35%_85%)] text-[hsl(150_45%_20%)] border-[hsl(150_30%_48%)]',
  info: 'bg-[hsl(186_35%_86%)] text-[hsl(186_55%_20%)] border-[hsl(186_30%_50%)]',
  idle: 'bg-muted text-muted-foreground border-border',
};
