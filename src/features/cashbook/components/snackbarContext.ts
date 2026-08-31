import { createContext } from 'react';

export type SnackbarKind = 'success' | 'error';

export interface SnackbarContextValue {
  notify: (kind: SnackbarKind, message: string) => void;
}

export const SnackbarContext = createContext<SnackbarContextValue | null>(null);
