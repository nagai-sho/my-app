import styles from './StatusState.module.css';

interface StatusStateProps {
  kind: 'error' | 'empty';
  message: string;
  onRetry?: () => void;
}

export function StatusState({ kind, message, onRetry }: StatusStateProps): JSX.Element {
  return (
    <section className={styles.state} aria-live="polite">
      <div className={styles.symbol} aria-hidden="true">
        {kind === 'error' ? '!' : '＋'}
      </div>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          再読み込み
        </button>
      )}
    </section>
  );
}
