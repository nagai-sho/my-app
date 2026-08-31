import { CheckSquare, FolderInput, FolderPlus, Pencil, Square, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileCard } from "../components/FileCard";
import { useDocuments } from "../hooks/useDocuments";

function normalizeFolderPath(value: string) {
  return value
    .trim()
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function parentPath(path: string) {
  const parts = normalizeFolderPath(path).split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

function baseName(path: string) {
  return normalizeFolderPath(path).split("/").filter(Boolean).at(-1) ?? "";
}

export function Gallery() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentFolderPath, setCurrentFolderPath] = useState("");
  const [newFolderPath, setNewFolderPath] = useState("");
  const [folderMoveParentPath, setFolderMoveParentPath] = useState("");
  const [moveTargetPath, setMoveTargetPath] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const {
    documents,
    folders,
    loading,
    upload,
    error,
    refresh,
    uploadFiles,
    remove,
    removeMany,
    addFolder,
    renameFolderPath,
    removeFolder,
    moveMany,
    reorder,
  } = useDocuments();
  const visibleDocuments = useMemo(
    () => (currentFolderPath ? documents.filter((document) => document.folder_path === currentFolderPath) : documents),
    [currentFolderPath, documents],
  );
  const selectedDocuments = useMemo(
    () => documents.filter((document) => selectedIds.has(document.id)),
    [documents, selectedIds],
  );
  const currentFolderParentPath = parentPath(currentFolderPath);
  const folderMoveTargetPath = normalizeFolderPath([folderMoveParentPath, baseName(currentFolderPath)].filter(Boolean).join("/"));
  const folderMoveParentOptions = useMemo(
    () => folders.filter((folder) => folder.path !== currentFolderPath && !folder.path.startsWith(`${currentFolderPath}/`)),
    [currentFolderPath, folders],
  );
  const selectionMode = selectedIds.size > 0;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => visibleDocuments.some((document) => document.id === id))));
  }, [visibleDocuments]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(visibleDocuments.map((document) => document.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const createDirectory = () => {
    const childPath = normalizeFolderPath(newFolderPath);
    if (!childPath) return;
    const nextPath =
      currentFolderPath && childPath !== currentFolderPath && !childPath.startsWith(`${currentFolderPath}/`)
        ? normalizeFolderPath(`${currentFolderPath}/${childPath}`)
        : childPath;
    void addFolder(nextPath).then(() => {
      setCurrentFolderPath(nextPath);
      setFolderMoveParentPath(parentPath(nextPath));
      setNewFolderPath("");
    });
  };

  const renameDirectory = () => {
    if (!currentFolderPath) return;
    const next = window.prompt("新しいディレクトリ名", currentFolderPath);
    if (!next) return;
    const nextPath = normalizeFolderPath(next);
    void renameFolderPath(currentFolderPath, nextPath).then(() => {
      setCurrentFolderPath(nextPath);
      setFolderMoveParentPath(parentPath(nextPath));
      setMoveTargetPath(nextPath);
    });
  };

  const moveDirectory = () => {
    if (!currentFolderPath || !folderMoveTargetPath || folderMoveTargetPath === currentFolderPath) return;
    void renameFolderPath(currentFolderPath, folderMoveTargetPath).then(() => {
      setCurrentFolderPath(folderMoveTargetPath);
      setFolderMoveParentPath(parentPath(folderMoveTargetPath));
      setMoveTargetPath(folderMoveTargetPath);
    });
  };

  const deleteDirectory = () => {
    if (!currentFolderPath) return;
    if (!window.confirm(`${currentFolderPath} を削除しますか？ 空のディレクトリだけ削除できます。`)) return;
    void removeFolder(currentFolderPath).then(() => {
      setCurrentFolderPath("");
      setFolderMoveParentPath("");
      setMoveTargetPath("");
    });
  };

  return (
    <main className="page">
      <section className="directory-panel">
        <div className="directory-create">
          <label className="folder-field">
            <span>{currentFolderPath ? `${currentFolderPath} 内に作成` : "ディレクトリ作成"}</span>
            <input
              value={newFolderPath}
              placeholder={currentFolderPath ? "例: 2026" : "例: work/client-a/2026"}
              onChange={(event) => setNewFolderPath(event.currentTarget.value)}
            />
          </label>
          <button type="button" className="secondary-button" onClick={createDirectory} disabled={!newFolderPath.trim()}>
            <FolderPlus size={18} />
            作成
          </button>
        </div>
        <div className="directory-list" aria-label="ディレクトリ一覧">
          <button
            type="button"
            className={`directory-item ${currentFolderPath === "" ? "is-active" : ""}`}
            onClick={() => {
              setCurrentFolderPath("");
              setFolderMoveParentPath("");
              clearSelection();
            }}
          >
            すべて
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className={`directory-item ${currentFolderPath === folder.path ? "is-active" : ""}`}
              style={{ paddingLeft: `${12 + folder.path.split("/").length * 12}px` }}
              onClick={() => {
                setCurrentFolderPath(folder.path);
                setFolderMoveParentPath(parentPath(folder.path));
                setMoveTargetPath(folder.path);
                clearSelection();
              }}
            >
              {folder.name}
            </button>
          ))}
        </div>
        <div className="directory-actions">
          <label className="move-field">
            <span>親フォルダ</span>
            <select
              value={folderMoveParentPath}
              disabled={!currentFolderPath}
              onChange={(event) => setFolderMoveParentPath(event.currentTarget.value)}
            >
              <option value="">ルート</option>
              {folderMoveParentOptions.map((folder) => (
                <option key={folder.id} value={folder.path}>
                  {folder.path}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="secondary-button"
            disabled={!currentFolderPath || currentFolderParentPath === folderMoveParentPath || folderMoveTargetPath === currentFolderPath}
            onClick={moveDirectory}
          >
            <FolderInput size={18} />
            フォルダ移動
          </button>
          <button type="button" className="secondary-button" disabled={!currentFolderPath} onClick={renameDirectory}>
            <Pencil size={18} />
            名前変更
          </button>
          <button type="button" className="danger-button" disabled={!currentFolderPath} onClick={deleteDirectory}>
            <Trash2 size={18} />
            削除
          </button>
        </div>
      </section>

      <div className="toolbar">
        <label className="folder-field">
          <span>アップロード先</span>
          <select
            value={currentFolderPath}
            onChange={(event) => {
              const path = event.currentTarget.value;
              setCurrentFolderPath(path);
              setFolderMoveParentPath(parentPath(path));
            }}
          >
            <option value="">選択してください</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.path}>
                {folder.path}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="primary-button" disabled={!currentFolderPath} onClick={() => inputRef.current?.click()}>
          <Upload size={20} />
          アップロード
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          hidden
          onChange={(event) => {
            if (event.currentTarget.files) void uploadFiles(event.currentTarget.files, currentFolderPath);
            event.currentTarget.value = "";
          }}
        />
      </div>

      {documents.length > 0 ? (
        <div className="bulk-bar">
          <button type="button" className="secondary-button" onClick={selectionMode ? clearSelection : selectAll}>
            {selectionMode ? <X size={18} /> : <CheckSquare size={18} />}
            {selectionMode ? "選択解除" : "全選択"}
          </button>
          {selectionMode ? (
            <>
              <span>{selectedIds.size}件選択中</span>
              <label className="move-field">
                <span>移動先</span>
                <select value={moveTargetPath} onChange={(event) => setMoveTargetPath(event.currentTarget.value)}>
                  <option value="">選択してください</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.path}>
                      {folder.path}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="secondary-button"
                disabled={!moveTargetPath}
                onClick={() =>
                  void moveMany(selectedDocuments, moveTargetPath).then(() => {
                    clearSelection();
                    setCurrentFolderPath(moveTargetPath);
                  })
                }
              >
                移動
              </button>
              <button
                type="button"
                className="danger-button"
                onClick={() =>
                  void removeMany(selectedDocuments).then(() => {
                    clearSelection();
                  })
                }
              >
                <Trash2 size={18} />
                一括削除
              </button>
            </>
          ) : (
            <span className="muted-inline">
              <Square size={18} /> ファイルを選択できます
            </span>
          )}
        </div>
      ) : null}

      {upload ? (
        <div className="upload-status">
          <span>{upload.name}</span>
          <progress value={upload.progress} max={100} />
          <small>{upload.message}</small>
        </div>
      ) : null}
      {error ? <p className="alert">{error}</p> : null}
      {loading ? <p className="muted">読み込み中</p> : null}

      {!loading && visibleDocuments.length === 0 ? (
        <section className="empty-state">
          <h2>まだファイルがありません</h2>
          <p>{currentFolderPath ? "このディレクトリにファイルはありません。" : "ディレクトリを作成してからアップロードしてください。"}</p>
        </section>
      ) : (
        <section className="grid">
          {visibleDocuments.map((document, index) => (
            <Link
              key={document.id}
              to={{
                pathname: `/collection/viewer/${document.id}`,
                search: currentFolderPath ? `?folder=${encodeURIComponent(currentFolderPath)}` : "",
              }}
              className="card-link"
              onClick={(event) => {
                if (!selectionMode) return;
                event.preventDefault();
                toggleSelected(document.id);
              }}
            >
              <FileCard
                document={document}
                selected={selectedIds.has(document.id)}
                selectionMode={selectionMode}
                onToggleSelected={() => toggleSelected(document.id)}
                onDelete={() => void remove(document)}
                showOrderControls
                canMoveUp={index > 0}
                canMoveDown={index < visibleDocuments.length - 1}
                onMoveUp={() => void reorder(document, "up")}
                onMoveDown={() => void reorder(document, "down")}
              />
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
