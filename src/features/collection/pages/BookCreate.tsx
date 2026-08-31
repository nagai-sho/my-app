import { ArrowLeft, BookPlus, Pencil, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDocuments } from "../hooks/useDocuments";
import { baseName, normalizeFolderPath } from "../lib/paths";

export function BookCreate() {
  const navigate = useNavigate();
  const { documents, folders, addFolder, renameFolderPath, removeFolder, removeMany, refresh, error } = useDocuments();
  const [title, setTitle] = useState("");
  const [renameTargetPath, setRenameTargetPath] = useState("");
  const [renameTitle, setRenameTitle] = useState("");
  const [deleteTargetPath, setDeleteTargetPath] = useState("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createBook = (event: FormEvent) => {
    event.preventDefault();
    const path = normalizeFolderPath(title);
    if (!path) return;
    void addFolder(path).then(() => {
      navigate(`/collection/books/detail?path=${encodeURIComponent(path)}`);
    });
  };

  const deleteBook = () => {
    if (!deleteTargetPath) return;
    const bookTitle = baseName(deleteTargetPath);
    const documentsInBook = documents.filter(
      (document) => document.folder_path === deleteTargetPath || document.folder_path.startsWith(`${deleteTargetPath}/`),
    );
    if (!window.confirm(`${bookTitle} を削除しますか？ 書籍内の画像も削除されます。`)) return;
    void removeMany(documentsInBook)
      .then(() => removeFolder(deleteTargetPath))
      .then(() => {
        setDeleteTargetPath("");
        void refresh();
      });
  };

  const renameBook = () => {
    const nextPath = normalizeFolderPath(renameTitle);
    if (!renameTargetPath || !nextPath || nextPath === renameTargetPath) return;
    void renameFolderPath(renameTargetPath, nextPath).then(() => {
      setRenameTargetPath(nextPath);
      setRenameTitle(baseName(nextPath));
      void refresh();
      navigate(`/collection/books/detail?path=${encodeURIComponent(nextPath)}`);
    });
  };

  return (
    <main className="page form-page">
      <Link to="/collection" className="back-link">
        <ArrowLeft size={20} /> 書籍一覧へ
      </Link>
      <form className="book-form" onSubmit={createBook}>
        <div>
          <p className="eyebrow">book registration</p>
          <h2>書籍登録</h2>
        </div>
        <label className="folder-field">
          <span>新しい書籍タイトル</span>
          <input value={title} placeholder="例: 旅のアルバム 2026" onChange={(event) => setTitle(event.currentTarget.value)} />
        </label>
        {error ? <p className="alert">{error}</p> : null}
        <button type="submit" className="primary-button" disabled={!normalizeFolderPath(title)}>
          <BookPlus size={20} />
          作成
        </button>
      </form>
      <section className="book-form">
        <div>
          <p className="eyebrow">rename book</p>
          <h2>書籍名変更</h2>
        </div>
        <label className="folder-field">
          <span>変更する書籍</span>
          <select
            value={renameTargetPath}
            onChange={(event) => {
              const path = event.currentTarget.value;
              setRenameTargetPath(path);
              setRenameTitle(baseName(path));
            }}
          >
            <option value="">選択してください</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.path}>
                {baseName(folder.path)}
              </option>
            ))}
          </select>
        </label>
        <label className="folder-field">
          <span>新しい書籍名</span>
          <input value={renameTitle} placeholder="例: 旅のアルバム 2026" onChange={(event) => setRenameTitle(event.currentTarget.value)} />
        </label>
        <button
          type="button"
          className="secondary-button"
          disabled={!renameTargetPath || !normalizeFolderPath(renameTitle) || normalizeFolderPath(renameTitle) === renameTargetPath}
          onClick={renameBook}
        >
          <Pencil size={20} />
          名前を変更
        </button>
      </section>
      <section className="book-form danger-zone">
        <div>
          <p className="eyebrow">delete book</p>
          <h2>書籍削除</h2>
        </div>
        <label className="folder-field">
          <span>削除する書籍</span>
          <select value={deleteTargetPath} onChange={(event) => setDeleteTargetPath(event.currentTarget.value)}>
            <option value="">選択してください</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.path}>
                {baseName(folder.path)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="danger-button" disabled={!deleteTargetPath} onClick={deleteBook}>
          <Trash2 size={20} />
          選択した書籍を削除
        </button>
      </section>
    </main>
  );
}
