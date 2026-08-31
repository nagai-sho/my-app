import { useMemo, type PropsWithChildren } from 'react';

import { createCollectionApi } from './apiClient';
import { CollectionApiContext } from './apiContext';

export function CollectionApiProvider({ idToken, children }: PropsWithChildren<{ idToken: string | null }>): JSX.Element {
  const api = useMemo(() => createCollectionApi(idToken), [idToken]);
  return <CollectionApiContext.Provider value={api}>{children}</CollectionApiContext.Provider>;
}
