import { useContext } from 'react';

import { CollectionApiContext } from './apiContext';
import type { CollectionApi } from './apiClient';

export function useCollectionApi(): CollectionApi {
  const api = useContext(CollectionApiContext);
  if (!api) throw new Error('CollectionApiProviderが必要です');
  return api;
}
