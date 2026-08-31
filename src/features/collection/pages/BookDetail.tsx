import { ArrowLeft, CheckSquare, FolderInput, Pencil, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { FileCard } from "../components/FileCard";
import { useDocuments } from "../hooks/useDocuments";
import { baseName, normalizeFolderPath } from "../lib/paths";

export function BookDetail() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const bookPath = normalizeFolderPath(searchParams.get("path") ?? "");
  const [editMode, setEditMode] = useState(false);
  const [moveTargetBookPath, setMoveTargetBookPath] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { documents, folders, loading, upload, error, refresh, uploadFiles, remove, removeMany, moveMany, reorder } = useDocuments();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const book = useMemo(() => folders.find((folder) => folder.path === bookPath), [bookPath, folders]);
  const pages = useMemo(
    () => documents.filter((document) => document.folder_path === bookPath),
    [bookPath, documents],
  );
  const selectedDocuments = useMemo(
    () => documents.filter((document) => selectedIds.has(document.id)),
    [documents, selectedIds],
  );
  const moveTargetBooks = useMemo(() => folders.filter((folder) => folder.path !== bookPath), [bookPath, folders]);
  const selectionMode = editMode;

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => pages.some((document) => document.id === id))));
  }, [pages]);

  if (!bookPath) return <Navigate to="/collection" replace />;

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(pages.map((document) => document.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const closeEditMode = () => {
    setEditMode(false);
    clearSelection();
    setMoveTargetBookPath("");
  };

  return (
    <main className="page book-detail-page">
      <div className="page-title">
        <div>
          <Link to="/collection" className="back-link">
            <ArrowLeft size={20} /> 書籍一覧へ
          </Link>
          <p className="eyebrow">book contents</p>
          <h2>{baseName(bookPath)}</h2>
        </div>
        <button type="button" className="primary-button" disabled={!book} onClick={() => inputRef.current?.click()}>
          <Upload size={20} />
          ページ追加
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          hidden
          onChange={(event) => {
            if (event.currentTarget.files) void uploadFiles(event.currentTarget.files, bookPath);
            event.currentTarget.value = "";
          }}
        />
      </div>

      {upload ? (
        <div className="upload-status">
          <span>{upload.name}</span>
          <progress value={upload.progress} max={100} />
          <small>{upload.message}</small>
        </div>
      ) : null}
      {error ? <p className="alert">{error}</p> : null}
      {loading ? <p className="muted">読み込み中</p> : null}

      {pages.length > 0 ? (
        <div className="bulk-bar">
          {!editMode ? (
            <button type="button" className="secondary-button" onClick={() => setEditMode(true)}>
              <Pencil size={18} />
              編集
            </button>
          ) : (
            <>
              <button type="button" className="secondary-button" onClick={selectAll}>
                <CheckSquare size={18} />
                全選択
              </button>
              <button type="button" className="secondary-button" onClick={closeEditMode}>
                <X size={18} />
                完了
              </button>
              <label className="move-field">
                <span>移動先書籍</span>
                <select value={moveTargetBookPath} onChange={(event) => setMoveTargetBookPath(event.currentTarget.value)}>
                  <option value="">選択してください</option>
                  {moveTargetBooks.map((folder) => (
                    <option key={folder.id} value={folder.path}>
                      {baseName(folder.path)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="secondary-button"
                disabled={selectedIds.size === 0 || !moveTargetBookPath}
                onClick={() =>
                  void moveMany(selectedDocuments, moveTargetBookPath).then(() => {
                    closeEditMode();
                  })
                }
              >
                <FolderInput size={18} />
                移動
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={selectedIds.size === 0}
                onClick={() =>
                  void removeMany(selectedDocuments).then(() => {
                    closeEditMode();
                  })
                }
              >
                <Trash2 size={18} />
                選択ページ削除
              </button>
            </>
          )}
        </div>
      ) : null}

      {!loading && pages.length === 0 ? (
        <section className="empty-state">
          <h2>ページがありません</h2>
          <p>ページ追加から画像をアップロードしてください。</p>
        </section>
      ) : (
        <section className="grid">
          {pages.map((document, index) => (
            <Link
              key={document.id}
              to={{
                pathname: `/collection/viewer/${document.id}`,
                search: `?folder=${encodeURIComponent(bookPath)}`,
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
                canMoveDown={index < pages.length - 1}
                onMoveUp={() => void reorder(document, "up")}
                onMoveDown={() => void reorder(document, "down")}
                showMeta={false}
                showDelete={false}
              />
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
