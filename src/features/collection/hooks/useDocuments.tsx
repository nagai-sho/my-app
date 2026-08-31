import { useContext } from 'react';
import { useStore } from 'zustand';

import { DocumentsContext } from './documentsContext';
import type { DocumentsState } from '../lib/documentsStore';

export function useDocuments(): DocumentsState {
  const store = useContext(DocumentsContext);
  if (!store) throw new Error('CollectionDocumentsProviderが必要です');
  return useStore(store);
}
