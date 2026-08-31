import { useState } from 'react';
import { ROOT_FOLDER_ID, rootFolder } from '../lib/sampleData';
import { getFolderName, getFolderSelectOptions } from '../lib/folders';
import type { Folder } from '../types';

interface FolderPanelProps {
  folders: Folder[];
  currentFolderId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string, parentId: string | null) => Promise<unknown>;
  onMove: (id: string, parentId: string | null) => Promise<unknown>;
  onDelete?: (id: string) => void;
  defaultOpen?: boolean;
}

export function FolderPanel({ folders, currentFolderId, onSelect, onCreate, onMove, onDelete, defaultOpen = false }: FolderPanelProps) {
  const [name, setName] = useState('');
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
  const isRootFolder = currentFolderId === ROOT_FOLDER_ID;
  const childFolders = folders.filter((folder) => (
    isRootFolder
      ? folder.id !== ROOT_FOLDER_ID && (folder.parentId === null || folder.parentId === ROOT_FOLDER_ID)
      : folder.parentId === currentFolderId
  ));
  const currentFolder = folders.find((folder) => folder.id === currentFolderId) ?? rootFolder;
  const hasChildFolders = childFolders.length > 0;
  const descendantIdsByFolder = new Map<string, Set<string>>();
  const getDescendantIds = (folderId: string): Set<string> => {
    const cached = descendantIdsByFolder.get(folderId);
    if (cached) return cached;
    const descendants = new Set<string>();
    folders
      .filter((folder) => folder.parentId === folderId)
      .forEach((folder) => {
        descendants.add(folder.id);
        getDescendantIds(folder.id).forEach((id) => descendants.add(id));
      });
    descendantIdsByFolder.set(folderId, descendants);
    return descendants;
  };
  const folderOptions = getFolderSelectOptions(folders);

  const renderMoveMenu = (folder: Folder) => (
    <div className="folder-move-menu" role="menu" aria-label={`${folder.name}の移動先`}>
      {folderOptions
        .filter(({ folder: target }) => target.id !== folder.id && !getDescendantIds(folder.id).has(target.id))
        .map(({ folder: target, label }) => (
          <button
            key={target.id}
            type="button"
            role="menuitem"
            onClick={() => {
              const nextParentId = target.id === ROOT_FOLDER_ID ? null : target.id;
              if ((folder.parentId ?? ROOT_FOLDER_ID) === target.id) {
                setMovingFolderId(null);
                return;
              }
              void onMove(folder.id, nextParentId).then(() => setMovingFolderId(null));
            }}
          >
            {label}
          </button>
        ))}
    </div>
  );

  const content = (
    <>
      {(!isRootFolder || hasChildFolders) && (
        <div className="folder-group">
          <span className="folder-group-label">サブディレクトリ</span>
          <ul className="folder-list">
            {childFolders.map((folder) => (
              <li key={folder.id}>
                <div className="folder-row">
                  <button className="folder-open" type="button" onClick={() => onSelect(folder.id)} aria-label={folder.name}>
                    <span>{folder.name}</span>
                  </button>
                  <button
                    className="folder-move-trigger"
                    type="button"
                    aria-label={`${folder.name}の移動先を開く`}
                    aria-expanded={movingFolderId === folder.id}
                    onClick={() => setMovingFolderId((value) => (value === folder.id ? null : folder.id))}
                  >
                    ▾
                  </button>
                  {onDelete && (
                    <button className="folder-delete-trigger" type="button" aria-label={`${folder.name}を削除`} onClick={() => onDelete(folder.id)}>
                      ×
                    </button>
                  )}
                </div>
                {movingFolderId === folder.id && renderMoveMenu(folder)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) return;
          void onCreate(name, currentFolderId).then(() => setName(''));
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={`${getFolderName(currentFolder)}内に新しいディレクトリ`}
          aria-label="新しいディレクトリ名"
        />
        <button type="submit">追加</button>
        <button className="folder-up" type="button" onClick={() => onSelect(ROOT_FOLDER_ID)}>
          戻る
        </button>
      </form>
    </>
  );

  if (defaultOpen) {
    const sidebarFolderOptions = folderOptions.filter(({ folder }) => folder.id !== ROOT_FOLDER_ID);

    return (
      <section className="panel folder-panel">
        <div className="folder-panel-heading">
          <div className="folder-panel-title">
            <span>ディレクトリ一覧</span>
            <span>{getFolderName(currentFolder)}</span>
          </div>
          <div>
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!name.trim()) return;
                void onCreate(name, currentFolderId).then(() => setName(''));
              }}
            >
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={`${getFolderName(currentFolder)}内に新しいディレクトリ`}
                aria-label="新しいディレクトリ名"
              />
              <button type="submit">追加</button>
            </form>
          </div>
        </div>

        <div className="folder-group">
          <ul className="folder-list">
            <li>
              <div className="folder-row">
                <button
                  className={`folder-open ${currentFolderId === ROOT_FOLDER_ID ? 'selected' : ''}`}
                  type="button"
                  onClick={() => onSelect(ROOT_FOLDER_ID)}
                  aria-label={getFolderName(rootFolder)}
                >
                  <span>{getFolderName(rootFolder)}</span>
                </button>
              </div>
            </li>
            {sidebarFolderOptions.map(({ folder, label }) => (
              <li key={folder.id}>
                <div className="folder-row">
                  <button
                    className={`folder-open ${folder.id === currentFolderId ? 'selected' : ''}`}
                    type="button"
                    onClick={() => onSelect(folder.id)}
                    aria-label={label}
                  >
                    <span>{label}</span>
                  </button>
                  <button
                    className="folder-move-trigger"
                    type="button"
                    aria-label={`${folder.name}の移動先を開く`}
                    aria-expanded={movingFolderId === folder.id}
                    onClick={() => setMovingFolderId((value) => (value === folder.id ? null : folder.id))}
                  >
                    ▾
                  </button>
                  {onDelete && (
                    <button className="folder-delete-trigger" type="button" aria-label={`${folder.name}を削除`} onClick={() => onDelete(folder.id)}>
                      ×
                    </button>
                  )}
                </div>
                {movingFolderId === folder.id && renderMoveMenu(folder)}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <details className="panel folder-panel">
      <summary>
        <span>ディレクトリ</span>
        <span>{getFolderName(currentFolder)}</span>
      </summary>
      {content}
    </details>
  );
}

