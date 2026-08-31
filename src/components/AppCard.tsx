import { forwardRef, useState } from 'react';

import { getMonogram, getMonogramColor } from '../features/apps/monogram';
import type { App } from '../types/app';
import styles from './AppCard.module.css';

interface AppCardProps {
  app: App;
  openInNewTab: boolean;
  onKeyDown?: (event: React.KeyboardEvent<HTMLAnchorElement>) => void;
}

export const AppCard = forwardRef<HTMLAnchorElement, AppCardProps>(function AppCard(
  { app, openInNewTab, onKeyDown },
  ref,
) {
  const [imageFailed, setImageFailed] = useState(false);
  const shouldShowImage = Boolean(app.iconUrl) && !imageFailed;

  return (
    <a
      ref={ref}
      className={styles.card}
      href={app.url}
      target={openInNewTab ? '_blank' : undefined}
      rel={openInNewTab ? 'noreferrer' : undefined}
      aria-label={`${app.name}を開く`}
      onKeyDown={onKeyDown}
    >
      <span className={styles.icon} style={{ backgroundColor: getMonogramColor(app.name) }}>
        {shouldShowImage ? (
          <img
            src={app.iconUrl}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span aria-hidden="true">{getMonogram(app.name)}</span>
        )}
      </span>
      <span className={styles.name}>{app.name}</span>
      <span className={styles.description}>{app.description || '説明はありません'}</span>
      {app.pinned && (
        <span className={styles.pinned} title="ピン留め済み" aria-label="ピン留め済み">
          ★
        </span>
      )}
    </a>
  );
});
