import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getFolderName, type FolderBreadcrumbItem } from './lib/folders';
import { ROOT_FOLDER_ID, rootFolder } from './lib/sampleData';
import { CardsPage } from './pages/CardsPage';
import { StudyPage } from './pages/StudyPage';

interface WordAppProps {
  idToken: string | null;
  onLogout: () => void;
}

export function WordApp({ idToken, onLogout }: WordAppProps): JSX.Element {
  const location = useLocation();
  const [studyFolderId, setStudyFolderId] = useState(ROOT_FOLDER_ID);
  const [studyFolderBreadcrumb, setStudyFolderBreadcrumb] = useState<FolderBreadcrumbItem[]>([
    { id: ROOT_FOLDER_ID, name: getFolderName(rootFolder) },
  ]);
  const [cardsFolderId, setCardsFolderId] = useState(ROOT_FOLDER_ID);
  const [cardsFolderBreadcrumb, setCardsFolderBreadcrumb] = useState<FolderBreadcrumbItem[]>([
    { id: ROOT_FOLDER_ID, name: getFolderName(rootFolder) },
  ]);
  const [studySidebarOpen, setStudySidebarOpen] = useState(false);
  const [cardsSidebarOpen, setCardsSidebarOpen] = useState(false);
  const showStudyFolder = location.pathname === '/word' || location.pathname === '/';
  const showCardsFolder = location.pathname === '/word/cards' || location.pathname === '/cards';
  const showHeaderNavigation = showStudyFolder || showCardsFolder;
  const updateFolderBreadcrumb = useCallback((items: FolderBreadcrumbItem[], setItems: Dispatch<SetStateAction<FolderBreadcrumbItem[]>>) => {
    setItems((currentItems) => {
      const isSameBreadcrumb = currentItems.length === items.length
        && currentItems.every((item, index) => item.id === items[index]?.id && item.name === items[index]?.name);

      return isSameBreadcrumb ? currentItems : items;
    });
  }, []);
  const updateStudyFolderBreadcrumb = useCallback((items: FolderBreadcrumbItem[]) => {
    updateFolderBreadcrumb(items, setStudyFolderBreadcrumb);
  }, [updateFolderBreadcrumb]);
  const updateCardsFolderBreadcrumb = useCallback((items: FolderBreadcrumbItem[]) => {
    updateFolderBreadcrumb(items, setCardsFolderBreadcrumb);
  }, [updateFolderBreadcrumb]);
  const activeFolderId = showStudyFolder ? studyFolderId : cardsFolderId;
  const activeFolderBreadcrumb = showStudyFolder ? studyFolderBreadcrumb : cardsFolderBreadcrumb;
  const onActiveFolderClick = showStudyFolder ? setStudyFolderId : setCardsFolderId;

  return (
    <div className="word-app">
      <div className="app">
        <header className="app-header">
          <div className="header-title">
            {(showStudyFolder || showCardsFolder) && (
              <button
                className="study-menu-button"
                type="button"
                aria-label={showStudyFolder ? '学習設定を開く' : '編集ディレクトリを開く'}
                aria-controls={showStudyFolder ? 'study-sidebar' : 'cards-sidebar'}
                aria-expanded={showStudyFolder ? studySidebarOpen : cardsSidebarOpen}
                onClick={() => {
                  if (showStudyFolder) {
                    setStudySidebarOpen((value) => !value);
                    return;
                  }
                  setCardsSidebarOpen((value) => !value);
                }}
              >
                <span aria-hidden="true">☰</span>
              </button>
            )}
            <h1>word-app</h1>
            {(showStudyFolder || showCardsFolder) && (
              <div className="header-folder" aria-label="現在のディレクトリ">
                {activeFolderBreadcrumb.map((folder, index) => (
                  <span className="header-folder-part" key={folder.id}>
                    {index > 0 && <span className="header-folder-separator"> - </span>}
                    <button
                      className="header-folder-button"
                      type="button"
                      aria-current={folder.id === activeFolderId ? 'page' : undefined}
                      onClick={() => onActiveFolderClick(folder.id)}
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <nav>
            {showHeaderNavigation && !showStudyFolder && <NavLink to="/word">学習</NavLink>}
            {showHeaderNavigation && !showCardsFolder && <NavLink to="/word/cards">編集</NavLink>}
            <button type="button" className="secondary logout-button" aria-label="ログアウト" onClick={onLogout}>
              <svg className="logout-icon" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                <path d="M10 17.5V20H5V4h5v2.5" />
                <path d="M15 8l4 4-4 4" />
                <path d="M8 12h11" />
              </svg>
            </button>
          </nav>
        </header>
        {showCardsFolder ? (
          <CardsPage
            idToken={idToken}
            currentFolderId={cardsFolderId}
            onCurrentFolderIdChange={setCardsFolderId}
            sidebarOpen={cardsSidebarOpen}
            onCloseSidebar={() => setCardsSidebarOpen(false)}
            onCurrentFolderBreadcrumbChange={updateCardsFolderBreadcrumb}
          />
        ) : (
          <StudyPage
            idToken={idToken}
            currentFolderId={studyFolderId}
            onCurrentFolderIdChange={setStudyFolderId}
            sidebarOpen={studySidebarOpen}
            onCloseSidebar={() => setStudySidebarOpen(false)}
            onCurrentFolderBreadcrumbChange={updateStudyFolderBreadcrumb}
          />
        )}
      </div>
    </div>
  );
}
