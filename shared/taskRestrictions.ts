export type RestrictionDurationUnit = 'days' | 'months' | 'years';

/**
 * The restriction remains active through the final calendar day of its period.
 * The release notification is therefore due the following day.
 */
export function getRestrictionReleaseDate(
  eventDate: string,
  durationValue: number,
  durationUnit: RestrictionDurationUnit,
): string {
  if (!isValidCalendarDate(eventDate)) throw new RangeError('実施日が正しくありません。');
  if (!Number.isInteger(durationValue) || durationValue < 1) throw new RangeError('制限期間は1以上で指定してください。');

  const [year, month, day] = eventDate.split('-').map(Number);
  const periodEnd = new Date(0);
  periodEnd.setUTCHours(0, 0, 0, 0);
  periodEnd.setUTCFullYear(year, month - 1, day);

  if (durationUnit === 'days') {
    periodEnd.setUTCDate(periodEnd.getUTCDate() + durationValue);
  } else {
    const addedMonths = durationUnit === 'years' ? durationValue * 12 : durationValue;
    const targetMonthIndex = year * 12 + (month - 1) + addedMonths;
    const targetYear = Math.floor(targetMonthIndex / 12);
    const targetMonth = targetMonthIndex % 12;
    const lastDay = new Date(0);
    lastDay.setUTCHours(0, 0, 0, 0);
    lastDay.setUTCFullYear(targetYear, targetMonth + 1, 0);
    const targetDay = Math.min(day, lastDay.getUTCDate());
    periodEnd.setUTCDate(targetDay);
    periodEnd.setUTCFullYear(targetYear, targetMonth, targetDay);
  }

  periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);
  const releaseYear = periodEnd.getUTCFullYear();
  if (releaseYear < 0 || releaseYear > 9999) throw new RangeError('解除日が扱える範囲を超えています。');
  return [String(releaseYear).padStart(4, '0'), String(periodEnd.getUTCMonth() + 1).padStart(2, '0'), String(periodEnd.getUTCDate()).padStart(2, '0')].join('-');
}

export function isValidCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(Number(yearText), Number(monthText) - 1, Number(dayText));
  return date.getUTCFullYear() === Number(yearText)
    && date.getUTCMonth() === Number(monthText) - 1
    && date.getUTCDate() === Number(dayText);
}
