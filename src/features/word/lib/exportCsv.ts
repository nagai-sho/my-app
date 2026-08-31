import { getFolderName } from './folders';
import { ROOT_FOLDER_ID } from './sampleData';
import type { Card, Folder } from '../types';

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function getExportDirectory(folders: Folder[], folderId: string): string {
  if (folderId === ROOT_FOLDER_ID) return '';

  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const names: string[] = [];
  const visited = new Set<string>();
  let current = folderById.get(folderId);

  while (current && current.id !== ROOT_FOLDER_ID && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(getFolderName(current));
    current = current.parentId ? folderById.get(current.parentId) : undefined;
  }

  return names.join('/');
}

export function buildCardsCsv(cards: Card[], folders: Folder[]): string {
  const header = ['front', 'back', 'directory', 'status', 'createdAt', 'updatedAt'];
  const rows = cards.map((card) => [
    card.frontText,
    card.backText,
    getExportDirectory(folders, card.folderId),
    card.status,
    card.createdAt,
    card.updatedAt,
  ]);

  return `\uFEFF${[header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')}\n`;
}

export function downloadCardsCsv(cards: Card[], folders: Folder[]) {
  const blob = new Blob([buildCardsCsv(cards, folders)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `word-app-export-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

