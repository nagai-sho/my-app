import { createContext } from 'react';

import { createDocumentsStore } from '../lib/documentsStore';

export type DocumentsStore = ReturnType<typeof createDocumentsStore>;

export const DocumentsContext = createContext<DocumentsStore | null>(null);
