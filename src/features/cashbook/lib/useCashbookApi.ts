import { useContext } from 'react';

import { CashbookApiContext } from './apiContext';
import type { CashbookApi } from './apiClient';

export function useCashbookApi(): CashbookApi {
  const client = useContext(CashbookApiContext);
  if (!client) throw new Error('useCashbookApi must be used inside CashbookApiProvider');
  return client;
}
