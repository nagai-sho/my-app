import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { CashbookApiContext } from './apiContext';
import { createCashbookApi } from './apiClient';

export function CashbookApiProvider({ idToken, children }: { idToken: string | null; children: ReactNode }) {
  const client = useMemo(() => createCashbookApi(idToken), [idToken]);
  return <CashbookApiContext.Provider value={client}>{children}</CashbookApiContext.Provider>;
}
