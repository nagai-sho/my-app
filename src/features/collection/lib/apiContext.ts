import { createContext } from 'react';

import type { CollectionApi } from './apiClient';

export const CollectionApiContext = createContext<CollectionApi | null>(null);
