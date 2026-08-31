import type { Card, Folder } from '../types';

const DB_NAME = 'my-app-word-cache';
const DB_VERSION = 1;
const CARDS_STORE = 'cards';
const FOLDERS_STORE = 'folders';

type CacheRecord = Card | Folder;

function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CARDS_STORE)) database.createObjectStore(CARDS_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(FOLDERS_STORE)) database.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened'));
  });
}

async function readAll<T extends CacheRecord>(storeName: string): Promise<T[]> {
  const database = await openCache();
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'));
    });
  } finally {
    database.close();
  }
}

async function put(storeName: string, value: CacheRecord): Promise<void> {
  const database = await openCache();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('IndexedDB write failed'));
    });
  } finally {
    database.close();
  }
}

async function remove(storeName: string, id: string): Promise<void> {
  const database = await openCache();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(storeName, 'readwrite').objectStore(storeName).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('IndexedDB delete failed'));
    });
  } finally {
    database.close();
  }
}

export async function readCachedCards(): Promise<Card[]> { return readAll<Card>(CARDS_STORE); }
export async function readCachedFolders(): Promise<Folder[]> { return readAll<Folder>(FOLDERS_STORE); }
export async function cacheCard(card: Card): Promise<void> { return put(CARDS_STORE, card); }
export async function cacheFolder(folder: Folder): Promise<void> { return put(FOLDERS_STORE, folder); }
export async function removeCachedCard(id: string): Promise<void> { return remove(CARDS_STORE, id); }
export async function removeCachedFolder(id: string): Promise<void> { return remove(FOLDERS_STORE, id); }
export async function clearWordCache(): Promise<void> {
  const database = await openCache();
  try {
    await Promise.all([CARDS_STORE, FOLDERS_STORE].map((storeName) => new Promise<void>((resolve, reject) => {
      const request = database.transaction(storeName, 'readwrite').objectStore(storeName).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('IndexedDB clear failed'));
    })));
  } finally {
    database.close();
  }
}
