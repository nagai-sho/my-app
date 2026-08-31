import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useFileObjectUrl } from "../hooks/useFileObjectUrl";
import type { StoredDocument } from "../types/document";

type Props = {
  document: StoredDocument;
  onDelete: () => void;
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelected?: () => void;
  showOrderControls?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  showMeta?: boolean;
  showDelete?: boolean;
};

export function FileCard({
  document,
  onDelete,
  selected = false,
  selectionMode = false,
  onToggleSelected,
  showOrderControls = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  showMeta = true,
  showDelete = true,
}: Props) {
  const thumbnailUrl = useFileObjectUrl(document.id, "thumbnail", document.has_thumbnail);

  return (
    <article className={`file-card ${selected ? "is-selected" : ""} ${!showMeta ? "is-image-only" : ""}`}>
      {selectionMode ? (
        <label className="select-box" onClick={(event) => event.stopPropagation()}>
          <input type="checkbox" checked={selected} onChange={onToggleSelected} />
          <span>選択</span>
        </label>
      ) : null}
      <div className="thumb">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <span className="thumb-placeholder" aria-hidden="true">ファイル</span>
        )}
      </div>
      {showOrderControls && !selectionMode ? (
        <div className="order-controls" aria-label="並び替え">
          <button
            type="button"
            className="icon-button"
            aria-label="前へ移動"
            disabled={!canMoveUp}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onMoveUp?.();
            }}
          >
            <ArrowUp size={17} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="後ろへ移動"
            disabled={!canMoveDown}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onMoveDown?.();
            }}
          >
            <ArrowDown size={17} />
          </button>
        </div>
      ) : null}
      {showMeta ? (
        <div className="file-meta">
          <strong>{document.title}</strong>
          {document.folder_path ? <span>{document.folder_path}</span> : null}
          <span>{formatDate(document.source_created_at)}</span>
          <span>
            {document.kind.toUpperCase()} / {document.page_count}p / {formatBytes(document.bytes)}
          </span>
        </div>
      ) : null}
      {showDelete ? (
        <button
          type="button"
          className="icon-button delete-button"
          aria-label="削除"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={18} />
        </button>
      ) : null}
    </article>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
