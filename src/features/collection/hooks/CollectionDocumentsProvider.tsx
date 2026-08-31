import { useMemo, type PropsWithChildren } from 'react';

import { useCollectionApi } from '../lib/useCollectionApi';
import { createDocumentsStore } from '../lib/documentsStore';
import { DocumentsContext } from './documentsContext';

export function CollectionDocumentsProvider({ children }: PropsWithChildren): JSX.Element {
  const api = useCollectionApi();
  const store = useMemo(() => createDocumentsStore(api), [api]);
  return <DocumentsContext.Provider value={store}>{children}</DocumentsContext.Provider>;
}
