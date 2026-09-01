import type { Task } from './apiClient';

export type TaskFilter = 'all' | 'today' | 'overdue' | 'done' | 'allTasks';
export type TaskSort = 'due' | 'priority' | 'created';

export interface TaskMetrics {
  pending: number;
  today: number;
  overdue: number;
  done: number;
}

const priorityRank: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2 };

export function getTaskMetrics(tasks: Task[], today: string): TaskMetrics {
  return tasks.reduce<TaskMetrics>((metrics, task) => {
    if (task.status === 'done') {
      metrics.done += 1;
      return metrics;
    }

    metrics.pending += 1;
    if (task.dueDate === today) metrics.today += 1;
    if (Boolean(task.dueDate) && task.dueDate! < today) metrics.overdue += 1;
    return metrics;
  }, { pending: 0, today: 0, overdue: 0, done: 0 });
}

export function filterTasks(tasks: Task[], filter: TaskFilter, query: string, today: string): Task[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return tasks.filter((task) => {
    if (filter === 'all' && task.status === 'done') return false;
    if (filter === 'today' && (task.status === 'done' || task.dueDate !== today)) return false;
    if (filter === 'overdue' && (task.status === 'done' || !task.dueDate || task.dueDate >= today)) return false;
    if (filter === 'done' && task.status !== 'done') return false;
    if (normalizedQuery && !`${task.title} ${task.description}`.toLocaleLowerCase().includes(normalizedQuery)) return false;
    return true;
  });
}

export function sortTasks(tasks: Task[], sort: TaskSort): Task[] {
  return [...tasks].sort((left, right) => {
    const doneOrder = Number(left.status === 'done') - Number(right.status === 'done');
    if (doneOrder !== 0) return doneOrder;

    if (sort === 'priority') {
      const priorityOrder = priorityRank[left.priority] - priorityRank[right.priority];
      if (priorityOrder !== 0) return priorityOrder;
    }

    if (sort === 'created') {
      const createdOrder = right.createdAt - left.createdAt;
      if (createdOrder !== 0) return createdOrder;
    } else {
      const leftDue = left.dueDate || '9999-12-31';
      const rightDue = right.dueDate || '9999-12-31';
      if (leftDue !== rightDue) return leftDue < rightDue ? -1 : 1;
      if (sort === 'due') {
        const priorityOrder = priorityRank[left.priority] - priorityRank[right.priority];
        if (priorityOrder !== 0) return priorityOrder;
      }
    }

    return right.updatedAt - left.updatedAt;
  });
}

export function isOverdue(task: Task, today: string): boolean {
  return task.status !== 'done' && Boolean(task.dueDate) && task.dueDate! < today;
}

export function isToday(task: Task, today: string): boolean {
  return task.status !== 'done' && task.dueDate === today;
}
