import { useRef } from 'react';

import type { App } from '../types/app';
import { AppCard } from './AppCard';
import styles from './AppGrid.module.css';

interface AppGridProps {
  apps: App[];
  openInNewTab: boolean;
}

function getColumnCount(grid: HTMLElement): number {
  const columns = window.getComputedStyle(grid).gridTemplateColumns;
  return columns.split(' ').filter(Boolean).length || 1;
}

export function AppGrid({ apps, openInNewTab }: AppGridProps): JSX.Element {
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  function handleCardKeyDown(index: number, event: React.KeyboardEvent<HTMLAnchorElement>) {
    if (!gridRef.current) {
      return;
    }

    const columnCount = getColumnCount(gridRef.current);
    let nextIndex = index;
    if (event.key === 'ArrowRight') {
      nextIndex = Math.min(index + 1, apps.length - 1);
    } else if (event.key === 'ArrowLeft') {
      nextIndex = Math.max(index - 1, 0);
    } else if (event.key === 'ArrowDown') {
      nextIndex = Math.min(index + columnCount, apps.length - 1);
    } else if (event.key === 'ArrowUp') {
      nextIndex = Math.max(index - columnCount, 0);
    } else {
      return;
    }

    if (nextIndex !== index) {
      event.preventDefault();
      cardRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div ref={gridRef} className={styles.grid} aria-label="登録アプリ一覧">
      {apps.map((app, index) => (
        <AppCard
          key={app.id}
          ref={(element) => {
            cardRefs.current[index] = element;
          }}
          app={app}
          openInNewTab={openInNewTab}
          onKeyDown={(event) => handleCardKeyDown(index, event)}
        />
      ))}
    </div>
  );
}
