import { rootFolder, starterCards } from './sampleData';
import { DEFAULT_CARD_STATUS, isCardStatus } from './cardStatus';
import type { Card, Folder } from '../types';

async function apiJson<T>(path: string, init: RequestInit | undefined, idToken: string | null): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  if (idToken) {
    headers.set('Authorization', `Bearer ${idToken}`);
  }

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
  const body = await apiJson<{ cards?: (Card & { status?: unknown })[] }>('/api/v1/word/cards', undefined, idToken);
  return (body.cards ?? []).map(normalizeCard);
}

export async function saveCard(card: Card, idToken: string | null): Promise<void> {
  await apiJson<{ ok: boolean }>('/api/v1/word/cards', {
    method: 'POST',
    body: JSON.stringify(card),
  }, idToken);
}

export async function deleteCard(id: string, idToken: string | null): Promise<void> {
  await apiJson<{ ok: boolean }>(`/api/v1/word/cards?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }, idToken);
}

export async function deleteFoldersAndCards(folderIds: Set<string>, idToken: string | null): Promise<void> {
  const [folderId] = folderIds;
  if (!folderId) return;

  await apiJson<{ ok: boolean }>(`/api/v1/word/folders?id=${encodeURIComponent(folderId)}`, {
    method: 'DELETE',
  }, idToken);
}

export async function getFolders(idToken: string | null): Promise<Folder[]> {
  const body = await apiJson<{ folders?: Folder[] }>('/api/v1/word/folders', undefined, idToken);
  return body.folders ?? [];
}

export async function saveFolder(folder: Folder, idToken: string | null): Promise<void> {
  if (folder.id === rootFolder.id) return;

  await apiJson<{ ok: boolean }>('/api/v1/word/folders', {
    method: 'POST',
    body: JSON.stringify(folder),
  }, idToken);
}
