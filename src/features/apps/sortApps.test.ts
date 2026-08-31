import { describe, expect, it } from 'vitest';

import { sortApps } from './sortApps';
import type { App } from '../../types/app';

const createApp = (overrides: Partial<App>): App => ({
  id: 'default',
  name: 'Default',
  url: 'https://example.com',
  sortOrder: 0,
  pinned: false,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('sortApps', () => {
  it('sorts pinned apps first, then sort order, then name', () => {
    const apps = [
      createApp({ id: 'z', name: 'Zulu', pinned: false, sortOrder: 1 }),
      createApp({ id: 'b', name: 'Beta', pinned: true, sortOrder: 20 }),
      createApp({ id: 'a', name: 'Alpha', pinned: true, sortOrder: 10 }),
      createApp({ id: 'c', name: 'Charlie', pinned: false, sortOrder: 1 }),
    ];

    expect(sortApps(apps).map((app) => app.id)).toEqual(['a', 'b', 'c', 'z']);
  });

  it('does not mutate the source array', () => {
    const apps = [createApp({ id: 'b' }), createApp({ id: 'a' })];

    sortApps(apps);

    expect(apps.map((app) => app.id)).toEqual(['b', 'a']);
  });
});
