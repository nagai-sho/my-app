import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, NavLink, useLocation } from 'react-router-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { SnackbarProvider } from './components/Snackbar';
import { CashbookApiProvider } from './lib/api';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

interface CashbookAppProps {
  idToken: string | null;
  onLogout: () => void;
}

export function CashbookApp({ idToken, onLogout }: CashbookAppProps): JSX.Element {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: { staleTime: 20_000, retry: 1 },
      },
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SnackbarProvider>
        <CashbookApiProvider idToken={idToken}>
          <CashbookLayout onLogout={onLogout} />
        </CashbookApiProvider>
      </SnackbarProvider>
    </QueryClientProvider>
  );
}

function CashbookLayout({ onLogout }: { onLogout: () => void }): JSX.Element {
  const location = useLocation();
  const isSettings = location.pathname === '/cashbook/settings';

  if (location.pathname === '/cashbook/transactions') {
    return <Navigate to="/cashbook" replace />;
  }
  if (location.pathname === '/cashbook/categories') {
    return <Navigate to="/cashbook/settings" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/" className="text-lg font-semibold tracking-normal">
            Cashbook
          </NavLink>
          <nav className="flex flex-wrap items-center justify-end gap-2 text-sm">
            <NavLink end className={({ isActive }) => navClass(isActive)} to="/cashbook">
              Dashboard
            </NavLink>
            <NavLink className={({ isActive }) => navClass(isActive)} to="/cashbook/settings">
              Settings
            </NavLink>
            <button
              type="button"
              className="touch-button rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={onLogout}
            >
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4 pb-24">
        <ErrorBoundary>
          {isSettings ? <SettingsPage /> : <DashboardPage />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

function navClass(isActive: boolean): string {
  return [
    'rounded-md px-3 py-2 transition',
    isActive
      ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
      : 'text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-900',
  ].join(' ');
}
