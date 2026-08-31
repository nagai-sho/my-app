import { createContext } from 'react';

import type { CashbookApi } from './apiClient';

export const CashbookApiContext = createContext<CashbookApi | null>(null);
