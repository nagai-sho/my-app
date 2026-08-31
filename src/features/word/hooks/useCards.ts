import { useCallback, useEffect, useMemo, useState } from 'react';
import { createId } from '../lib/id';
import { deleteCard, deleteFoldersAndCards, ensureSeedData, getCards, getFolders, saveCard, saveFolder } from '../lib/db';
import { normalizeWord } from '../lib/duplicates';
import { getFolderAndDescendantIds } from '../lib/folders';
import { DEFAULT_CARD_STATUS } from '../lib/cardStatus';
import { ROOT_FOLDER_ID, rootFolder } from '../lib/sampleData';
import type { Card, CardStatus, Folder } from '../types';

interface CardInput {
  frontText: string;
  backText: string;
  folderId: string;
  status?: CardStatus;
}

export interface UpsertCardResult {
  card?: Card;
  duplicate?: Card;
}

export function useCards(idToken: string | null) {
  const [cards, setCards] = useState<Card[]>([]);
  const [folders, setFolders] = useState<Folder[]>([rootFolder]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      await ensureSeedData(idToken);
      const [nextCards, nextFolders] = await Promise.all([getCards(idToken), getFolders(idToken)]);
      setCards(nextCards.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      setFolders(nextFolders.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      setError('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'データの読み込みに失敗しました。');
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    void reload(true);
  }, [reload]);

  const upsertCard = useCallback(async (input: CardInput, id?: string): Promise<UpsertCardResult> => {
    const now = new Date().toISOString();
    const existing = cards.find((card) => card.id === id);
    const normalizedFrontText = normalizeWord(input.frontText);
    const duplicate = cards.find((card) => card.id !== id && normalizeWord(card.frontText) === normalizedFrontText);

    if (duplicate) {
      return { duplicate };
    }

    const card: Card = {
      id: existing?.id ?? createId(),
      frontText: input.frontText.trim(),
      backText: input.backText.trim(),
      folderId: input.folderId || ROOT_FOLDER_ID,
      status: input.status ?? existing?.status ?? DEFAULT_CARD_STATUS,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await saveCard(card, idToken);
    await reload();
    return { card };
  }, [cards, idToken, reload]);

  const removeCard = useCallback(async (id: string) => {
    await deleteCard(id, idToken);
    await reload();
  }, [idToken, reload]);

  const createFolder = useCallback(async (name: string, parentId: string | null) => {
    const folder: Folder = {
      id: createId(),
      name: name.trim(),
      parentId: parentId === ROOT_FOLDER_ID ? null : parentId,
      createdAt: new Date().toISOString(),
    };
    await saveFolder(folder, idToken);
    await reload();
    return folder;
  }, [idToken, reload]);

  const moveFolder = useCallback(async (id: string, parentId: string | null) => {
    const folder = folders.find((item) => item.id === id);
    if (!folder || folder.id === ROOT_FOLDER_ID) return undefined;
    const movedFolder: Folder = { ...folder, parentId: parentId === ROOT_FOLDER_ID ? null : parentId };
    await saveFolder(movedFolder, idToken);
    await reload();
    return movedFolder;
  }, [folders, idToken, reload]);

  const removeFolder = useCallback(async (id: string) => {
    const folder = folders.find((item) => item.id === id);
    if (!folder || folder.id === ROOT_FOLDER_ID) return undefined;
    const folderIds = getFolderAndDescendantIds(folders, id);
    await deleteFoldersAndCards(folderIds, idToken);
    await reload();
    return { folder, folderIds };
  }, [folders, idToken, reload]);

  return useMemo(
    () => ({ cards, folders, loading, error, upsertCard, removeCard, createFolder, moveFolder, removeFolder }),
    [cards, folders, loading, error, upsertCard, removeCard, createFolder, moveFolder, removeFolder],
  );
}
