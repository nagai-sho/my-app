import { useRef } from 'react';

import type { App, AppCategory } from '../types/app';
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

const categoryMeta: Array<{ key: AppCategory; label: string; kicker: string }> = [
  { key: 'integrated', label: 'アプリ', kicker: 'INTEGRATED APPS' },
  { key: 'external', label: '外部リンク', kicker: 'EXTERNAL LINKS' },
];

export function AppGrid({ apps, openInNewTab }: AppGridProps): JSX.Element {
  const gridRefs = useRef<Partial<Record<AppCategory, HTMLDivElement | null>>>({});
  const cardRefs = useRef<Partial<Record<AppCategory, Array<HTMLAnchorElement | null>>>>({});

  function handleCardKeyDown(category: AppCategory, categoryApps: App[], index: number, event: React.KeyboardEvent<HTMLAnchorElement>) {
    const gridRef = gridRefs.current[category];
    if (!gridRef) {
      return;
    }

    const columnCount = getColumnCount(gridRef);
    let nextIndex = index;
    if (event.key === 'ArrowRight') {
      nextIndex = Math.min(index + 1, categoryApps.length - 1);
    } else if (event.key === 'ArrowLeft') {
      nextIndex = Math.max(index - 1, 0);
    } else if (event.key === 'ArrowDown') {
      nextIndex = Math.min(index + columnCount, categoryApps.length - 1);
    } else if (event.key === 'ArrowUp') {
      nextIndex = Math.max(index - columnCount, 0);
    } else {
      return;
    }

    if (nextIndex !== index) {
      event.preventDefault();
      cardRefs.current[category]?.[nextIndex]?.focus();
    }
  }

  return (
    <div className={styles.groups}>
      {categoryMeta.map((category) => {
        const categoryApps = apps.filter((app) => (app.category || 'integrated') === category.key);
        if (categoryApps.length === 0) return null;

        return (
          <section className={category.key === 'external' ? styles.groupExternal : styles.group} key={category.key} aria-labelledby={`${category.key}-apps-heading`}>
            <div className={styles.groupHeading}>
              <div>
                <p>{category.kicker}</p>
                <h3 id={`${category.key}-apps-heading`}>{category.label}</h3>
              </div>
              <span>{categoryApps.length}件</span>
            </div>
            <div
              ref={(element) => {
                gridRefs.current[category.key] = element;
              }}
              className={styles.grid}
              aria-label={`${category.label}一覧`}
            >
              {categoryApps.map((app, index) => (
                <AppCard
                  key={app.id}
                  ref={(element) => {
                    const refs = cardRefs.current[category.key] ?? [];
                    refs[index] = element;
                    cardRefs.current[category.key] = refs;
                  }}
                  app={app}
                  openInNewTab={openInNewTab}
                  onKeyDown={(event) => handleCardKeyDown(category.key, categoryApps, index, event)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
