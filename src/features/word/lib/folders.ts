import { ROOT_FOLDER_ID, rootFolder } from './sampleData';
import type { Folder } from '../types';

export interface FolderBreadcrumbItem {
  id: string;
  name: string;
}

export function getFolderName(folder: Folder): string {
  return folder.id === ROOT_FOLDER_ID ? 'トップ' : folder.name;
}

export function getFolderBreadcrumbItems(folders: Folder[], folderId: string): FolderBreadcrumbItem[] {
  if (folderId === ROOT_FOLDER_ID) return [{ id: ROOT_FOLDER_ID, name: getFolderName(rootFolder) }];

  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const items: FolderBreadcrumbItem[] = [];
  const visited = new Set<string>();
  let current = folderById.get(folderId);

  while (current && current.id !== ROOT_FOLDER_ID && !visited.has(current.id)) {
    visited.add(current.id);
    items.unshift({ id: current.id, name: getFolderName(current) });
    current = current.parentId ? folderById.get(current.parentId) : undefined;
  }

  return items.length > 0 ? items : [{ id: ROOT_FOLDER_ID, name: getFolderName(rootFolder) }];
}

export function getFolderBreadcrumb(folders: Folder[], folderId: string): string {
  return getFolderBreadcrumbItems(folders, folderId).map((item) => item.name).join(' - ');
}

export function getFolderSelectOptions(folders: Folder[]): { folder: Folder; label: string }[] {
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const childrenByParent = new Map<string, Folder[]>();

  folders.forEach((folder) => {
    if (folder.id === ROOT_FOLDER_ID) return;

    const parentId = folder.parentId && folderById.has(folder.parentId) ? folder.parentId : ROOT_FOLDER_ID;
    const children = childrenByParent.get(parentId) ?? [];
    children.push(folder);
    childrenByParent.set(parentId, children);
  });

  const options: { folder: Folder; label: string }[] = [{ folder: rootFolder, label: getFolderName(rootFolder) }];
  const visited = new Set<string>();

  const appendChildren = (parentId: string, depth: number) => {
    (childrenByParent.get(parentId) ?? []).forEach((folder) => {
      if (visited.has(folder.id)) return;
      visited.add(folder.id);

      const prefix = depth === 0 ? '' : `${'　'.repeat(depth - 1)}∟`;
      options.push({ folder, label: `${prefix}${getFolderName(folder)}` });
      appendChildren(folder.id, depth + 1);
    });
  };

  appendChildren(ROOT_FOLDER_ID, 0);

  return options;
}

export function getFolderAndDescendantIds(folders: Folder[], folderId: string): Set<string> {
  const ids = new Set<string>([folderId]);

  const appendChildren = (parentId: string) => {
    folders
      .filter((folder) => folder.parentId === parentId)
      .forEach((folder) => {
        if (ids.has(folder.id)) return;
        ids.add(folder.id);
        appendChildren(folder.id);
      });
  };

  appendChildren(folderId);

  return ids;
}

