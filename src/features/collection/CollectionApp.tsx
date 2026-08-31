import { BookOpen, BookPlus, FolderOpen, LogOut } from 'lucide-react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';

import { CollectionDocumentsProvider } from './hooks/CollectionDocumentsProvider';
import { CollectionApiProvider } from './lib/CollectionApiProvider';
import { BookCreate } from './pages/BookCreate';
import { BookDetail } from './pages/BookDetail';
import { BookList } from './pages/BookList';
import { Gallery } from './pages/Gallery';
import { Viewer } from './pages/Viewer';
import { ErrorBoundary } from './components/ErrorBoundary';

interface CollectionAppProps {
  idToken: string | null;
  onLogout: () => void;
}

export function CollectionApp({ idToken, onLogout }: CollectionAppProps): JSX.Element {
  return (
    <CollectionApiProvider idToken={idToken}>
      <CollectionDocumentsProvider>
        <div className="collection-app">
          <CollectionHeader onLogout={onLogout} />
          <ErrorBoundary>
            <Routes>
              <Route index element={<BookList />} />
              <Route path="books/edit" element={<BookCreate />} />
              <Route path="books/new" element={<Navigate to="/collection/books/edit" replace />} />
              <Route path="books/detail" element={<BookDetail />} />
              <Route path="gallery" element={<Gallery />} />
              <Route path="viewer/:id" element={<Viewer />} />
              <Route path="*" element={<Navigate to="/collection" replace />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </CollectionDocumentsProvider>
    </CollectionApiProvider>
  );
}

function CollectionHeader({ onLogout }: { onLogout: () => void }): JSX.Element {
  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">private stacks</p>
        <h1>書棚</h1>
      </div>
      <nav className="user-area" aria-label="書棚メニュー">
        <NavLink to="/" className="collection-nav-link" aria-label="ホームに戻る">
          ホーム
        </NavLink>
        <NavLink to="/collection" end className="collection-nav-link">
          <BookOpen size={18} />
          書籍
        </NavLink>
        <NavLink to="/collection/gallery" className="collection-nav-link">
          <FolderOpen size={18} />
          ファイル
        </NavLink>
        <NavLink to="/collection/books/edit" className="icon-button" aria-label="書籍登録">
          <BookPlus size={20} />
        </NavLink>
        <button type="button" className="icon-button" aria-label="ログアウト" onClick={onLogout}>
          <LogOut size={20} />
        </button>
      </nav>
    </header>
  );
}
