import { useEffect, useMemo, useState } from 'react';
import { CardForm } from '../components/CardForm';
import { Snackbar } from '../components/Snackbar';
import { StudyView } from '../components/StudyView';
import { useCards } from '../hooks/useCards';
import { useSpeech } from '../hooks/useSpeech';
import { CARD_STATUS_LABELS, CARD_STATUSES, type CardStatusFilter } from '../lib/cardStatus';
import { getFolderAndDescendantIds, getFolderBreadcrumbItems, getFolderSelectOptions, type FolderBreadcrumbItem } from '../lib/folders';
import { ROOT_FOLDER_ID } from '../lib/sampleData';
import type { Card, CardStatus, Folder } from '../types';

function StudyFolderSelect({
  folders,
  currentFolderId,
  onSelect,
}: {
  folders: Folder[];
  currentFolderId: string;
  onSelect: (folderId: string) => void;
}) {
  return (
    <section className="panel study-folder-select">
      <label>
        表示するディレクトリ
        <select value={currentFolderId} onChange={(event) => onSelect(event.target.value)}>
          {getFolderSelectOptions(folders).map(({ folder, label }) => (
            <option key={folder.id} value={folder.id}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

function StudyStatusSelect({
  status,
  onSelect,
}: {
  status: CardStatusFilter;
  onSelect: (status: CardStatusFilter) => void;
}) {
  return (
    <section className="panel study-folder-select">
      <label>
        表示するステータス
        <select value={status} onChange={(event) => onSelect(event.target.value as CardStatusFilter)}>
          <option value="all">すべて</option>
          {CARD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {CARD_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

export function StudyPage({
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
  const { cards, folders, loading, error, upsertCard } = useCards(idToken);
  const speech = useSpeech();
  const [currentStatus, setCurrentStatus] = useState<CardStatusFilter>('all');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const visibleFolderIds = currentFolderId === ROOT_FOLDER_ID ? null : getFolderAndDescendantIds(folders, currentFolderId);
  const visibleCards = cards.filter((card) => (
    (!visibleFolderIds || visibleFolderIds.has(card.folderId))
    && (currentStatus === 'all' || card.status === currentStatus)
  ));
  const currentFolderBreadcrumb = useMemo(
    () => getFolderBreadcrumbItems(folders, currentFolderId),
    [folders, currentFolderId],
  );

  useEffect(() => {
    onCurrentFolderBreadcrumbChange(currentFolderBreadcrumb);
  }, [currentFolderBreadcrumb, onCurrentFolderBreadcrumbChange]);

  if (loading) return <main className="shell"><section className="empty">読み込み中</section></main>;
  if (error) return <main className="shell"><section className="empty">{error}</section></main>;

  const notify = (message: string) => setSnackbarMessage(message);
  const updateCard = (card: Card, input: { folderId?: string; status?: CardStatus }) => {
    void upsertCard({
      frontText: card.frontText,
      backText: card.backText,
      folderId: input.folderId ?? card.folderId,
      status: input.status ?? card.status,
    }, card.id).then((result) => {
      if (result?.card) notify('カードを更新しました。');
    });
  };

  return (
    <main className="shell study-shell">
      <div className="study-main">
        <StudyView
          cards={visibleCards}
          folders={folders}
          language={speech.language}
          setLanguage={speech.setLanguage}
          speak={speech.speak}
          speaking={speech.speaking}
          onChangeFolder={(card, folderId) => updateCard(card, { folderId })}
          onChangeStatus={(card, status) => updateCard(card, { status })}
        />
      </div>
      <button
        className={`sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        type="button"
        aria-label="サイドバーを閉じる"
        onClick={onCloseSidebar}
      />
      <aside id="study-sidebar" className={`study-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="学習設定">
        <StudyFolderSelect folders={folders} currentFolderId={currentFolderId} onSelect={onCurrentFolderIdChange} />
        <StudyStatusSelect status={currentStatus} onSelect={setCurrentStatus} />
        <section className="panel quick-register">
          <div className="panel-header">
            <h2>単語を登録する</h2>
          </div>
          <CardForm
            folders={folders}
            selectedFolderId={currentFolderId}
            onSubmit={async (input, id) => {
              const result = await upsertCard(input, id);
              if (result?.card) notify('カードを登録しました。');
              return result;
            }}
            showFolderSelect={false}
          />
        </section>
      </aside>
      <Snackbar message={snackbarMessage} onClose={() => setSnackbarMessage('')} />
    </main>
  );
}
