import styles from './AppGrid.module.css';
import skeletonStyles from './SkeletonGrid.module.css';

interface SkeletonGridProps {
  count?: number;
}

export function SkeletonGrid({ count = 8 }: SkeletonGridProps): JSX.Element {
  return (
    <div className={styles.grid} aria-label="アプリ一覧を読み込み中" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className={skeletonStyles.card} key={index} aria-hidden="true">
          <span className={skeletonStyles.icon} />
          <span className={skeletonStyles.name} />
          <span className={skeletonStyles.description} />
          <span className={skeletonStyles.descriptionShort} />
        </div>
      ))}
    </div>
  );
}
