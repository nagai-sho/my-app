import type { CardStatus } from '../types';

export const DEFAULT_CARD_STATUS: CardStatus = 'new';

export const CARD_STATUS_LABELS: Record<CardStatus, string> = {
  new: '未履修',
  learning: '学習中',
  weak: '間違えやすい',
  reviewing: '復習中',
  mastered: '習得済み',
};

export const CARD_STATUSES = Object.keys(CARD_STATUS_LABELS) as CardStatus[];

export type CardStatusFilter = CardStatus | 'all';

export function isCardStatus(value: unknown): value is CardStatus {
  return typeof value === 'string' && value in CARD_STATUS_LABELS;
}

