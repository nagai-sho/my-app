export { getRestrictionReleaseDate } from '../../../shared/taskRestrictions';
export type { RestrictionDurationUnit } from '../../../shared/taskRestrictions';

export function formatRestrictionDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}
