import { describe, expect, it } from 'vitest';

import { getMonogram, getMonogramColor } from './monogram';

describe('monogram helpers', () => {
  it('uses the first non-space character and handles empty names', () => {
    expect(getMonogram(' Notes')).toBe('N');
    expect(getMonogram('タスク')).toBe('タ');
    expect(getMonogram('')).toBe('?');
  });

  it('returns a deterministic palette color', () => {
    expect(getMonogramColor('Notes')).toBe(getMonogramColor('Notes'));
    expect(getMonogramColor('Notes')).not.toBe('');
  });
});
