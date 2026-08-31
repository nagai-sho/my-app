import { BookOpen } from "lucide-react";
import { baseName } from "../lib/paths";
import type { StoredDocument } from "../types/document";
import { useFileObjectUrl } from "../hooks/useFileObjectUrl";

type Props = {
  path: string;
  cover?: StoredDocument;
  itemCount: number;
};

export function BookCard({ path, cover, itemCount }: Props) {
  const coverUrl = useFileObjectUrl(cover?.id, "thumbnail", Boolean(cover?.has_thumbnail));

  return (
    <article className="book-card">
      <div className="book-cover">
        {coverUrl ? <img src={coverUrl} alt="" loading="lazy" /> : <BookOpen size={54} />}
      </div>
      <div className="book-card-meta">
        <strong>{baseName(path)}</strong>
        <span>{itemCount}ページ</span>
      </div>
    </article>
  );
}
