import { useContext } from 'react';

import { SnackbarContext } from './snackbarContext';
import type { SnackbarContextValue } from './snackbarContext';

export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used inside SnackbarProvider');
  }
  return context;
}
