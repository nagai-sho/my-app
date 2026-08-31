import { rootFolder, starterCards } from './sampleData';
import { DEFAULT_CARD_STATUS, isCardStatus } from './cardStatus';
import {
  cacheCard,
  cacheFolder,
  clearWordCache,
  readCachedCards,
  readCachedFolders,
  removeCachedCard,
} from './offlineCache';
import type { Card, Folder } from '../types';

async function apiJson<T>(path: string, init: RequestInit | undefined, idToken: string | null): Promise<T> {
  void idToken;
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers,
  });

  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || `API request failed: ${response.status}`);
  }

  return body;
}

function normalizeCard(card: Card & { status?: unknown }): Card {
  return {
    ...card,
    status: isCardStatus(card.status) ? card.status : DEFAULT_CARD_STATUS,
  };
}

export async function ensureSeedData(idToken: string | null): Promise<void> {
  const folders = await getFolders(idToken);
  if (!folders.some((folder) => folder.id === rootFolder.id)) {
    await saveFolder(rootFolder, idToken);
  }

  const cards = await getCards(idToken);
  if (cards.length === 0) {
    await Promise.all(starterCards.map((card) => saveCard(card, idToken)));
  }
}

export async function getCards(idToken: string | null): Promise<Card[]> {
  try {
    const body = await apiJson<{ cards?: (Card & { status?: unknown })[] }>('/api/v1/word/cards', undefined, idToken);
    const cards = (body.cards ?? []).map(normalizeCard);
    await Promise.all(cards.map((card) => cacheCard(card).catch(() => undefined)));
    return cards;
  } catch (error) {
    const cached = await readCachedCards().catch(() => []);
    if (cached.length > 0) return cached.map(normalizeCard);
    throw error;
  }
}

export async function saveCard(card: Card, idToken: string | null): Promise<void> {
  await apiJson<{ ok: boolean }>('/api/v1/word/cards', {
    method: 'POST',
    body: JSON.stringify(card),
  }, idToken);
  await cacheCard(card).catch(() => undefined);
}

export async function deleteCard(id: string, idToken: string | null): Promise<void> {
  await apiJson<{ ok: boolean }>(`/api/v1/word/cards?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }, idToken);
  await removeCachedCard(id).catch(() => undefined);
}

export async function deleteFoldersAndCards(folderIds: Set<string>, idToken: string | null): Promise<void> {
  const [folderId] = folderIds;
  if (!folderId) return;

  await apiJson<{ ok: boolean }>(`/api/v1/word/folders?id=${encodeURIComponent(folderId)}`, {
    method: 'DELETE',
  }, idToken);
  await clearWordCache().catch(() => undefined);
}

export async function getFolders(idToken: string | null): Promise<Folder[]> {
  try {
    const body = await apiJson<{ folders?: Folder[] }>('/api/v1/word/folders', undefined, idToken);
    const folders = body.folders ?? [];
    await Promise.all(folders.map((folder) => cacheFolder(folder).catch(() => undefined)));
    return folders;
  } catch (error) {
    const cached = await readCachedFolders().catch(() => []);
    if (cached.length > 0) return cached;
    throw error;
  }
}

export async function saveFolder(folder: Folder, idToken: string | null): Promise<void> {
  if (folder.id === rootFolder.id) return;

  await apiJson<{ ok: boolean }>('/api/v1/word/folders', {
    method: 'POST',
    body: JSON.stringify(folder),
  }, idToken);
  await cacheFolder(folder).catch(() => undefined);
}
