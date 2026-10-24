import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { AuthProvider, useAuth } from '@/lib/factory';
import { Shell } from '@/components/shell';
import { ErrorState, Skeleton } from '@/components/bits';
import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import Orders from '@/pages/orders';
import NewOrder from '@/pages/new-order';
import OrderDetail from '@/pages/order-detail';
import Production from '@/pages/production';
import Inventory from '@/pages/inventory';
import Traceability from '@/pages/traceability';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, refetchOnWindowFocus: false } } });

function Gate() {
  const { user, isLoading, error, refetch } = useAuth();
  if (isLoading) return <div className="mx-auto max-w-xl p-10"><Skeleton rows={3} /></div>;
  if (error && !user) return <div className="mx-auto max-w-xl p-10"><ErrorState error={error} retry={refetch} /></div>;
  if (!user) return <Login />;
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/orders" component={Orders} />
          <Route path="/orders/new" component={NewOrder} />
          <Route path="/orders/:id" component={OrderDetail} />
          <Route path="/production" component={Production} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/traceability" component={Traceability} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthProvider>
            <Gate />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
