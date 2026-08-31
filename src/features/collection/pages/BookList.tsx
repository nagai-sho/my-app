import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { BookCard } from "../components/BookCard";
import { useDocuments } from "../hooks/useDocuments";

export function BookList() {
  const { documents, folders, loading, error, refresh } = useDocuments();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const books = useMemo(
    () =>
      folders.map((folder) => {
        const pages = documents.filter((document) => document.folder_path === folder.path);
        return {
          folder,
          cover: pages[0],
          itemCount: pages.length,
        };
      }),
    [documents, folders],
  );

  return (
    <main className="page shelf-page">
      {error ? <p className="alert">{error}</p> : null}
      {loading ? <p className="muted">読み込み中</p> : null}

      {!loading && books.length === 0 ? (
        <section className="empty-state">
          <h2>まだ書籍がありません</h2>
          <p>書籍を作成してから画像を追加してください。</p>
        </section>
      ) : (
        <section className="book-grid">
          {books.map(({ folder, cover, itemCount }) => (
            <Link key={folder.id} to={`/collection/books/detail?path=${encodeURIComponent(folder.path)}`} className="book-link">
              <BookCard path={folder.path} cover={cover} itemCount={itemCount} />
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
