import { describe, expect, it } from 'vitest';
import { formatCurrency, formatTransactionDateTime, fromDateInputValue } from './format';

describe('formatCurrency', () => {
  it('formats JPY without decimals', () => {
    expect(formatCurrency(123456)).toBe('￥123,456');
  });
});

describe('date-only transaction datetime', () => {
  it('stores date-only input at UTC midnight and displays only the date', () => {
    const value = fromDateInputValue('2026-05-30');

    expect(value).toBe('2026-05-30T00:00:00.000Z');
    expect(formatTransactionDateTime(value)).toBe('2026/05/30');
  });
});

