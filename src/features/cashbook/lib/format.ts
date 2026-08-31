import dayjs from 'dayjs';

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string): string {
  return dayjs(value).format('YYYY/MM/DD HH:mm');
}

export function formatTransactionDateTime(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value)) {
    return value.slice(0, 10).replaceAll('-', '/');
  }
  return formatDateTime(value);
}

export function formatDate(value: string): string {
  return dayjs(value).format('YYYY/MM/DD');
}

export function currentMonth(): string {
  return dayjs().format('YYYY-MM');
}

export function localMonth(value: string): string {
  return dayjs(value).format('YYYY-MM');
}

export function toDatetimeLocal(value: string): string {
  return dayjs(value).format('YYYY-MM-DDTHH:mm');
}

export function toDateInputValue(value: string): string {
  return dayjs(value).format('YYYY-MM-DD');
}

export function fromDatetimeLocal(value: string): string {
  return dayjs(value).toISOString();
}

export function fromDateInputValue(value: string): string {
  return `${value}T00:00:00.000Z`;
}

