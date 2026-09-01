import { forwardRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

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
  const isExternal = app.category === 'external';
  const opensInNewTab = openInNewTab || isExternal;

  return (
    <a
      ref={ref}
      className={isExternal ? `${styles.card} ${styles.externalCard}` : styles.card}
      href={app.url}
      target={opensInNewTab ? '_blank' : undefined}
      rel={opensInNewTab ? 'noreferrer' : undefined}
      aria-label={isExternal ? `${app.name}を外部リンクで開く` : `${app.name}を開く`}
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
      {isExternal && (
        <span className={styles.externalBadge}>
          <ExternalLink size={12} aria-hidden="true" />
          外部リンク
        </span>
      )}
      {app.pinned && (
        <span className={styles.pinned} title="ピン留め済み" aria-label="ピン留め済み">
          ★
        </span>
      )}
    </a>
  );
});
