import { useState } from 'react';

import styles from './AppHeader.module.css';

interface AppHeaderProps {
  openInNewTab: boolean;
  onToggleNewTab: () => void;
  onLogout: () => void;
}

export function AppHeader({
  openInNewTab,
  onToggleNewTab,
  onLogout,
}: AppHeaderProps): JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>PERSONAL APP LAUNCHER</p>
        <h1 className={styles.title}>my-app</h1>
      </div>
      <div className={styles.menuContainer}>
        <button
          type="button"
          className={styles.menuButton}
          aria-label="メニューを開く"
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          <span aria-hidden="true">•••</span>
        </button>
        {isMenuOpen && (
          <div className={styles.menu} role="menu">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={openInNewTab}
              className={styles.menuItem}
              onClick={onToggleNewTab}
            >
              <span aria-hidden="true">{openInNewTab ? '✓' : ''}</span>
              新しいタブで開く
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={onLogout}
            >
              <span aria-hidden="true">↪</span>
              ログアウト
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
