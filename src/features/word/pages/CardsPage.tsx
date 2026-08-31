import { useEffect, useMemo, useState } from 'react';
import { CardForm } from '../components/CardForm';
import { CsvImportPanel } from '../components/CsvImportPanel';
import { FolderPanel } from '../components/FolderPanel';
import { Snackbar } from '../components/Snackbar';
import { StatusBadge } from '../components/StatusBadge';
import { useCards } from '../hooks/useCards';
import { CARD_STATUS_LABELS, CARD_STATUSES, type CardStatusFilter } from '../lib/cardStatus';
import { downloadCardsCsv } from '../lib/exportCsv';
import { getFolderAndDescendantIds, getFolderBreadcrumbItems, getFolderName, type FolderBreadcrumbItem } from '../lib/folders';
import { ROOT_FOLDER_ID, rootFolder } from '../lib/sampleData';
import type { Card } from '../types';

type CardSortKey = 'createdAt' | 'updatedAt' | 'frontText' | 'status' | 'folder';
type SortDirection = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const STATUS_SORT_ORDER = new Map(CARD_STATUSES.map((status, index) => [status, index]));

export function CardsPage({
  idToken,
  currentFolderId,
  onCurrentFolderIdChange,
  sidebarOpen,
  onCloseSidebar,
  onCurrentFolderBreadcrumbChange,
}: {
  idToken: string | null;
  currentFolderId: string;
  onCurrentFolderIdChange: (folderId: string) => void;
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  onCurrentFolderBreadcrumbChange: (items: FolderBreadcrumbItem[]) => void;
}) {
  const { cards, folders, loading, error, upsertCard, removeCard, createFolder, moveFolder, removeFolder } = useCards(idToken);
  const [currentStatus, setCurrentStatus] = useState<CardStatusFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [sortKey, setSortKey] = useState<CardSortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const visibleFolderIds = currentFolderId === ROOT_FOLDER_ID ? null : getFolderAndDescendantIds(folders, currentFolderId);
  const visibleCards = cards.filter((card) => (
    (!visibleFolderIds || visibleFolderIds.has(card.folderId))
    && (currentStatus === 'all' || card.status === currentStatus)
  ));
  const sortedCards = useMemo(() => {
    const getSortValue = (card: Card): string | number => {
      if (sortKey === 'status') return STATUS_SORT_ORDER.get(card.status) ?? 0;
      if (sortKey === 'folder') return getFolderName(folders.find((folder) => folder.id === card.folderId) ?? rootFolder);
      return card[sortKey];
    };

    return [...visibleCards].sort((a, b) => {
      const valueA = getSortValue(a);
      const valueB = getSortValue(b);
      const compared = typeof valueA === 'number' && typeof valueB === 'number'
        ? valueA - valueB
        : String(valueA).localeCompare(String(valueB), 'ja');

      if (compared !== 0) return sortDirection === 'asc' ? compared : -compared;
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });
  }, [folders, sortDirection, sortKey, visibleCards]);
  const pageCount = Math.max(1, Math.ceil(sortedCards.length / pageSize));
  const pageStartIndex = (currentPage - 1) * pageSize;
  const paginatedCards = sortedCards.slice(pageStartIndex, pageStartIndex + pageSize);
  const editingCard = cards.find((card) => card.id === editingId);
  const deletingCard = cards.find((card) => card.id === deletingId);
  const deletingFolder = folders.find((folder) => folder.id === deletingFolderId);
  const deletingFolderIds = deletingFolder ? getFolderAndDescendantIds(folders, deletingFolder.id) : new Set<string>();
  const deletingFolderCardCount = cards.filter((card) => deletingFolderIds.has(card.folderId)).length;
  const deletingFolderSubfolderCount = Math.max(0, deletingFolderIds.size - 1);
  const currentFolderBreadcrumb = useMemo(
    () => getFolderBreadcrumbItems(folders, currentFolderId),
    [folders, currentFolderId],
  );

  useEffect(() => {
    onCurrentFolderBreadcrumbChange(currentFolderBreadcrumb);
  }, [currentFolderBreadcrumb, onCurrentFolderBreadcrumbChange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [currentFolderId, currentStatus, pageSize, sortDirection, sortKey]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  if (loading) return <main className="shell"><section className="empty">読み込み中</section></main>;
  if (error) return <main className="shell"><section className="empty">{error}</section></main>;

  const notify = (message: string) => setSnackbarMessage(message);
  const handleCreateFolder = async (name: string, parentId: string | null) => {
    const folder = await createFolder(name, parentId);
    notify('ディレクトリを作成しました。');
    return folder;
  };
  const handleMoveFolder = async (id: string, parentId: string | null) => {
    const folder = await moveFolder(id, parentId);
    if (folder) notify('ディレクトリを移動しました。');
    return folder;
  };
  const handleDeleteFolder = async (id: string) => {
    const result = await removeFolder(id);
    if (!result) return;
    if (result.folderIds.has(currentFolderId)) onCurrentFolderIdChange(ROOT_FOLDER_ID);
    notify('ディレクトリを削除しました。');
  };

  return (
    <main className="shell cards-shell">
      <button
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        type="button"
        aria-label="サイドバーを閉じる"
        onClick={onCloseSidebar}
      />
      <aside id="cards-sidebar" className={`cards-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="編集ディレクトリ">
        <FolderPanel
          folders={folders}
          currentFolderId={currentFolderId}
          onSelect={onCurrentFolderIdChange}
          onCreate={handleCreateFolder}
          onMove={handleMoveFolder}
          onDelete={setDeletingFolderId}
          defaultOpen
        />
      </aside>
      <div className="cards-content">
        <section className="panel">
          <div className="panel-header">
            <h2>カード登録</h2>
          </div>
          <CardForm
            folders={folders}
            selectedFolderId={currentFolderId}
            onSubmit={async (input, id) => {
              const result = await upsertCard(input, id);
              if (result?.card) {
                onCurrentFolderIdChange(result.card.folderId);
                notify('カードを登録しました。');
              }
              return result;
            }}
          />
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>データ出力</h2>
            <button type="button" className="secondary" disabled={cards.length === 0} onClick={() => downloadCardsCsv(cards, folders)}>
              CSVエクスポート
            </button>
          </div>
          <p className="panel-note">登録済みカード {cards.length}枚をCSVで出力します。</p>
        </section>
        <CsvImportPanel
          folders={folders}
          cards={cards}
          currentFolderId={currentFolderId}
          onCreateFolder={handleCreateFolder}
          onCreateCard={upsertCard}
          onImportComplete={(message) => notify(message)}
        />
        <section className="panel">
          <div className="panel-header">
            <h2>カード一覧</h2>
            <span>{visibleCards.length}枚</span>
          </div>
          <label className="status-filter">
            ステータス
            <select value={currentStatus} onChange={(event) => setCurrentStatus(event.target.value as CardStatusFilter)}>
              <option value="all">すべて</option>
              {CARD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CARD_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <div className="list-controls">
            <label>
              並び替え
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as CardSortKey)}>
                <option value="createdAt">登録日</option>
                <option value="updatedAt">更新日</option>
                <option value="frontText">表面</option>
                <option value="status">ステータス</option>
                <option value="folder">ディレクトリ</option>
              </select>
            </label>
            <label>
              順序
              <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value as SortDirection)}>
                <option value="asc">昇順</option>
                <option value="desc">降順</option>
              </select>
            </label>
            <label>
              表示件数
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {PAGE_SIZE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}件
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="card-list">
            {paginatedCards.map((card) => (
              <article className="list-card" key={card.id}>
                <div>
                  <strong>{card.frontText}</strong>
                  <span>{card.backText}</span>
                </div>
                <div className="row-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <StatusBadge status={card.status} />
                  <span>{getFolderName(folders.find((folder) => folder.id === card.folderId) ?? rootFolder)}</span>
                  <button type="button" onClick={() => setEditingId(card.id)}>編集</button>
                  <button type="button" className="danger" onClick={() => setDeletingId(card.id)}>削除</button>
                </div>
              </article>
            ))}
          </div>
          <div className="pagination" aria-label="カード一覧ページネーション">
            <span>
              {visibleCards.length === 0 ? 0 : pageStartIndex + 1}
              -
              {Math.min(pageStartIndex + pageSize, visibleCards.length)}
              件 / {visibleCards.length}件
            </span>
            <div className="pagination-actions">
              <button type="button" className="secondary" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>
                前へ
              </button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" className="secondary" disabled={currentPage >= pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}>
                次へ
              </button>
            </div>
          </div>
        </section>
      </div>
      {editingCard && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-card-title">
            <div className="panel-header">
              <h2 id="edit-card-title">カード編集</h2>
              <button type="button" className="secondary modal-close" aria-label="編集ダイアログを閉じる" onClick={() => setEditingId(null)}>
                ×
              </button>
            </div>
            <CardForm
              folders={folders}
              card={editingCard}
              selectedFolderId={currentFolderId}
              onSubmit={async (input, id) => {
                const result = await upsertCard(input, id);
                if (!result?.duplicate) {
                  setEditingId(null);
                  notify('カードを更新しました。');
                }
                return result;
              }}
              onCancel={() => setEditingId(null)}
            />
          </section>
        </div>
      )}
      {deletingCard && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal modal-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-card-title">
            <div className="panel-header">
              <h2 id="delete-card-title">カード削除</h2>
            </div>
            <p className="modal-text">
              「{deletingCard.frontText}」を削除します。この操作は取り消せません。
            </p>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setDeletingId(null)}>
                キャンセル
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  void removeCard(deletingCard.id).then(() => {
                    setDeletingId(null);
                    notify('カードを削除しました。');
                  });
                }}
              >
                削除する
              </button>
            </div>
          </section>
        </div>
      )}
      {deletingFolder && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal modal-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-folder-title">
            <div className="panel-header">
              <h2 id="delete-folder-title">ディレクトリ削除</h2>
            </div>
            <p className="modal-text">
              「{getFolderName(deletingFolder)}」を削除します。
              {deletingFolderSubfolderCount > 0 && ` サブディレクトリ${deletingFolderSubfolderCount}件も削除されます。`}
              {deletingFolderCardCount > 0 && ` 配下のカード${deletingFolderCardCount}枚も削除されます。`}
              この操作は取り消せません。
            </p>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setDeletingFolderId(null)}>
                キャンセル
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  void handleDeleteFolder(deletingFolder.id).then(() => setDeletingFolderId(null));
                }}
              >
                削除する
              </button>
            </div>
          </section>
        </div>
      )}
      <Snackbar message={snackbarMessage} onClose={() => setSnackbarMessage('')} />
    </main>
  );
}
