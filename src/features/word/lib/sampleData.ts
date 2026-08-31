import { DEFAULT_CARD_STATUS } from './cardStatus';
import type { Card, Folder } from '../types';

export const ROOT_FOLDER_ID = 'root';

export const rootFolder: Folder = {
  id: ROOT_FOLDER_ID,
  name: 'トップ',
  parentId: null,
  createdAt: new Date(0).toISOString(),
};

export const starterCards: Card[] = [
  {
    id: 'starter-hello',
    frontText: 'Hello',
    backText: 'こんにちは',
    folderId: ROOT_FOLDER_ID,
    status: DEFAULT_CARD_STATUS,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'starter-persist',
    frontText: 'Persist',
    backText: '保存する / 持続する',
    folderId: ROOT_FOLDER_ID,
    status: DEFAULT_CARD_STATUS,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
];

