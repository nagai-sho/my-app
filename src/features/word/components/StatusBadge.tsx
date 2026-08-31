import { CARD_STATUS_LABELS } from '../lib/cardStatus';
import type { CardStatus } from '../types';

export function StatusBadge({ status }: { status: CardStatus }) {
  return <span className={`status-badge status-badge-${status}`}>{CARD_STATUS_LABELS[status]}</span>;
}

