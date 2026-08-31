import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SnackbarContext } from './snackbarContext';
import type { SnackbarKind } from './snackbarContext';

interface SnackbarState {
  id: number;
  kind: SnackbarKind;
  message: string;
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snackbar, setSnackbar] = useState<SnackbarState | null>(null);

  const notify = useCallback((kind: SnackbarKind, message: string) => {
    setSnackbar({ id: Date.now(), kind, message });
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  useEffect(() => {
    if (!snackbar) return undefined;
    const timer = window.setTimeout(() => setSnackbar(null), 4000);
    return () => window.clearTimeout(timer);
  }, [snackbar]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {snackbar ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4" role="status" aria-live="polite">
          <div
            className={`pointer-events-auto max-w-[min(92vw,32rem)] rounded-md px-4 py-3 text-sm font-medium shadow-xl ${
              snackbar.kind === 'success'
                ? 'bg-slate-950 text-white dark:bg-zinc-100 dark:text-zinc-950'
                : 'bg-red-600 text-white dark:bg-red-500 dark:text-white'
            }`}
          >
            {snackbar.message}
          </div>
        </div>
      ) : null}
    </SnackbarContext.Provider>
  );
}
