import type { App } from '../../types/app';

export function sortApps(apps: App[]): App[] {
  return [...apps].sort((left, right) => {
    const pinnedOrder = Number(right.pinned) - Number(left.pinned);
    if (pinnedOrder !== 0) {
      return pinnedOrder;
    }

    const sortOrder = left.sortOrder - right.sortOrder;
    if (sortOrder !== 0) {
      return sortOrder;
    }

    const nameOrder = left.name.localeCompare(right.name, undefined, {
      sensitivity: 'base',
    });
    return nameOrder !== 0 ? nameOrder : left.id.localeCompare(right.id);
  });
}
