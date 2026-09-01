import { describe, expect, it } from 'vitest';

import { filterTasks, getTaskMetrics, sortTasks } from './taskHelpers';
import type { Task } from './apiClient';

const today = '2026-09-01';

function task(overrides: Partial<Task>): Task {
  return {
    id: 'task',
    title: 'タスク',
    description: '',
    dueDate: null,
    status: 'todo',
    priority: 'medium',
    createdAt: 1,
    updatedAt: 1,
    completedAt: null,
    ...overrides,
  };
}

describe('taskHelpers', () => {
  it('counts pending, today, overdue, and completed tasks', () => {
    const tasks = [
      task({ id: 'today', dueDate: today }),
      task({ id: 'late', dueDate: '2026-08-31' }),
      task({ id: 'done', status: 'done', dueDate: today }),
      task({ id: 'later', dueDate: '2026-09-05' }),
    ];

    expect(getTaskMetrics(tasks, today)).toEqual({ pending: 3, today: 1, overdue: 1, done: 1 });
  });

  it('filters out completed tasks from the default view and searches title/description', () => {
    const tasks = [
      task({ id: 'one', title: '請求書を確認', description: '経理' }),
      task({ id: 'two', title: '買い物', status: 'done' }),
    ];

    expect(filterTasks(tasks, 'all', '経理', today).map((item) => item.id)).toEqual(['one']);
    expect(filterTasks(tasks, 'allTasks', '', today).map((item) => item.id)).toEqual(['one', 'two']);
  });

  it('sorts unfinished tasks before completed tasks and honors due dates', () => {
    const tasks = [
      task({ id: 'done', status: 'done', dueDate: '2026-08-01' }),
      task({ id: 'later', dueDate: '2026-09-05' }),
      task({ id: 'soon', dueDate: today }),
    ];

    expect(sortTasks(tasks, 'due').map((item) => item.id)).toEqual(['soon', 'later', 'done']);
  });
});
