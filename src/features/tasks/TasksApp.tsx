import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  House,
  ListFilter,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { tasksApi, todayJst, type Task, type TaskInput, type TaskPriority, type TaskStatus } from './apiClient';
import {
  filterTasks,
  getTaskMetrics,
  isOverdue,
  isToday,
  sortTasks,
  type TaskFilter,
  type TaskSort,
} from './taskHelpers';
import styles from './TasksApp.module.css';

interface TasksAppProps {
  onLogout: () => void;
}

const priorityLabels: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

const statusLabels: Record<TaskStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  done: '完了',
};
const EMPTY_TASKS: Task[] = [];

export function TasksApp({ onLogout }: TasksAppProps): JSX.Element {
  const queryClient = useQueryClient();
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: tasksApi.list });
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [sort, setSort] = useState<TaskSort>('due');
  const [query, setQuery] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [editor, setEditor] = useState<Task | 'new' | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const today = useMemo(() => todayJst(), []);
  const tasks = tasksQuery.data?.tasks ?? EMPTY_TASKS;
  const metrics = useMemo(() => getTaskMetrics(tasks, today), [tasks, today]);
  const visibleTasks = useMemo(
    () => sortTasks(filterTasks(tasks, filter, query, today), sort),
    [filter, query, sort, tasks, today],
  );

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id?: string; input: TaskInput }) =>
      id ? tasksApi.update(id, input) : tasksApi.create(input),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (!variables.id) setQuickTitle('');
      setEditor(null);
      setOperationError(null);
    },
    onError: (error: unknown) => setOperationError(getErrorMessage(error, 'タスクの保存に失敗しました。')),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) => tasksApi.update(task.id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setOperationError(null);
    },
    onError: (error: unknown) => setOperationError(getErrorMessage(error, 'タスクの状態変更に失敗しました。')),
  });

  const removeMutation = useMutation({
    mutationFn: (task: Task) => tasksApi.remove(task.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditor(null);
      setOperationError(null);
    },
    onError: (error: unknown) => setOperationError(getErrorMessage(error, 'タスクの削除に失敗しました。')),
  });

  function openEditor(task: Task | null = null): void {
    setOperationError(null);
    setEditor(task ?? 'new');
  }

  function submitQuickAdd(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title || saveMutation.isPending) return;
    setOperationError(null);
    saveMutation.mutate({
      input: { title, description: '', dueDate: null, priority: 'medium', status: 'todo' },
    });
  }

  function submitEditor(input: TaskInput): void {
    const currentTask = editor !== 'new' ? editor : null;
    saveMutation.mutate({ id: currentTask?.id, input });
  }

  function confirmDelete(task: Task): void {
    if (removeMutation.isPending) return;
    if (window.confirm(`「${task.title}」を削除しますか？`)) removeMutation.mutate(task);
  }

  const filters: Array<{ key: TaskFilter; label: string; count: number; icon: ReactNode }> = [
    { key: 'all', label: '未完了', count: metrics.pending, icon: <Circle size={17} /> },
    { key: 'today', label: '今日', count: metrics.today, icon: <CalendarDays size={17} /> },
    { key: 'overdue', label: '期限超過', count: metrics.overdue, icon: <AlertCircle size={17} /> },
    { key: 'done', label: '完了', count: metrics.done, icon: <CheckCircle2 size={17} /> },
    { key: 'allTasks', label: 'すべて', count: tasks.length, icon: <ListFilter size={17} /> },
  ];
  const activeFilterLabel = filters.find((item) => item.key === filter)?.label ?? '未完了';
  const queryError = tasksQuery.error instanceof Error ? tasksQuery.error.message : null;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Link className={styles.homeButton} to="/" aria-label="ホームに戻る">
              <House size={18} />
            </Link>
            <div>
              <p className={styles.kicker}>PERSONAL TASKS</p>
              <h1>タスク管理</h1>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.headerButton}
              type="button"
              title="更新"
              aria-label="タスクを更新"
              onClick={() => void tasksQuery.refetch()}
              disabled={tasksQuery.isFetching}
            >
              <RefreshCw size={18} className={tasksQuery.isFetching ? styles.spinning : undefined} />
            </button>
            <button className={styles.headerButton} type="button" title="ログアウト" aria-label="ログアウト" onClick={onLogout}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>FOCUS YOUR DAY</p>
            <h2>やることを、見える状態に。</h2>
            <p>今日やることと、あとで取り組むことをひとつの場所で整理できます。</p>
          </div>
          <button className={styles.primaryButton} type="button" onClick={() => openEditor()}>
            <Plus size={18} />
            タスクを追加
          </button>
        </section>

        <section className={styles.stats} aria-label="タスクの概要">
          <StatCard label="未完了" value={metrics.pending} detail="これから取り組む" tone="blue" />
          <StatCard label="今日" value={metrics.today} detail="今日が期限" tone="purple" />
          <StatCard label="期限超過" value={metrics.overdue} detail="確認が必要" tone="red" />
          <StatCard label="完了" value={metrics.done} detail="積み上げた成果" tone="green" />
        </section>

        <section className={styles.quickAddSection} aria-labelledby="quick-add-title">
          <div className={styles.quickAddMark} aria-hidden="true"><Plus size={20} /></div>
          <div className={styles.quickAddBody}>
            <p id="quick-add-title" className={styles.quickAddLabel}>クイック追加</p>
            <form className={styles.quickAddForm} onSubmit={submitQuickAdd}>
              <label className={styles.srOnly} htmlFor="quick-task-title">タスク名</label>
              <input
                id="quick-task-title"
                value={quickTitle}
                onChange={(event) => setQuickTitle(event.target.value)}
                placeholder="次にやることを入力…"
                maxLength={200}
              />
              <button className={styles.quickAddButton} type="submit" disabled={!quickTitle.trim() || saveMutation.isPending}>
                <Plus size={17} />
                追加
              </button>
            </form>
            <button className={styles.detailsLink} type="button" onClick={() => openEditor()}>
              期限や優先度も設定する <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        <div className={styles.workspace}>
          <aside className={styles.sidebar} aria-label="タスクの表示切替">
            <div className={styles.sidebarHeading}>
              <span>ビュー</span>
              <span>{tasks.length}件</span>
            </div>
            <nav className={styles.filterList}>
              {filters.map((item) => (
                <button
                  className={item.key === filter ? styles.filterActive : styles.filterButton}
                  type="button"
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  aria-current={item.key === filter ? 'page' : undefined}
                >
                  <span className={styles.filterIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </button>
              ))}
            </nav>
            <div className={styles.sidebarNote}>
              <Clock3 size={15} />
              <span>期限を決めると、今日の集中先が見つけやすくなります。</span>
            </div>
          </aside>

          <section className={styles.taskPanel} aria-labelledby="task-list-title">
            <div className={styles.panelHeading}>
              <div>
                <p className={styles.panelKicker}>TASK LIST</p>
                <h2 id="task-list-title">{activeFilterLabel}</h2>
              </div>
              <span className={styles.resultCount}>{visibleTasks.length}件</span>
            </div>
            <div className={styles.toolbar}>
              <label className={styles.searchBox}>
                <Search size={17} aria-hidden="true" />
                <span className={styles.srOnly}>タスクを検索</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="タスクを検索" />
                {query && <button type="button" aria-label="検索をクリア" onClick={() => setQuery('')}><X size={15} /></button>}
              </label>
              <label className={styles.sortBox}>
                <span>並び順</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as TaskSort)}>
                  <option value="due">期限が近い順</option>
                  <option value="priority">優先度順</option>
                  <option value="created">追加が新しい順</option>
                </select>
              </label>
            </div>

            {operationError && <p className={styles.errorMessage} role="alert">{operationError}</p>}
            {tasksQuery.isLoading && <TaskListSkeleton />}
            {!tasksQuery.isLoading && queryError && (
              <div className={styles.stateCard}>
                <AlertCircle size={23} />
                <h3>タスクを読み込めませんでした</h3>
                <p>{queryError}</p>
                <button className={styles.secondaryButton} type="button" onClick={() => void tasksQuery.refetch()}>再読み込み</button>
              </div>
            )}
            {!tasksQuery.isLoading && !queryError && visibleTasks.length === 0 && (
              <EmptyState hasTasks={tasks.length > 0} filter={filter} query={query} onCreate={() => openEditor()} />
            )}
            {!tasksQuery.isLoading && !queryError && visibleTasks.length > 0 && (
              <div className={styles.taskList}>
                {visibleTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    today={today}
                    onToggle={() => toggleMutation.mutate({ task, status: task.status === 'done' ? 'todo' : 'done' })}
                    onEdit={() => openEditor(task)}
                    onDelete={() => confirmDelete(task)}
                    busy={toggleMutation.isPending || removeMutation.isPending}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {editor !== null && (
        <TaskEditorModal
          task={editor === 'new' ? null : editor}
          isSaving={saveMutation.isPending}
          onClose={() => { if (!saveMutation.isPending) setEditor(null); }}
          onSubmit={submitEditor}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: 'blue' | 'purple' | 'red' | 'green' }): JSX.Element {
  const toneClass = tone === 'blue'
    ? styles.statBlue
    : tone === 'purple'
      ? styles.statPurple
      : tone === 'red'
        ? styles.statRed
        : styles.statGreen;
  return (
    <article className={styles.statCard}>
      <div className={`${styles.statDot} ${toneClass}`} aria-hidden="true" />
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </article>
  );
}

function TaskCard({
  task,
  today,
  onToggle,
  onEdit,
  onDelete,
  busy,
}: {
  task: Task;
  today: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}): JSX.Element {
  const overdue = isOverdue(task, today);
  const dueToday = isToday(task, today);
  const dueClass = overdue ? styles.dueOverdue : dueToday ? styles.dueToday : styles.dueNormal;
  const priorityClass = task.priority === 'high'
    ? styles.priorityHigh
    : task.priority === 'low'
      ? styles.priorityLow
      : styles.priorityMedium;

  return (
    <article className={task.status === 'done' ? styles.taskCardDone : styles.taskCard}>
      <button
        className={task.status === 'done' ? styles.checkButtonDone : styles.checkButton}
        type="button"
        aria-label={task.status === 'done' ? '未完了に戻す' : '完了にする'}
        aria-pressed={task.status === 'done'}
        onClick={onToggle}
        disabled={busy}
      >
        {task.status === 'done' && <Check size={16} strokeWidth={3} />}
      </button>
      <button className={styles.taskMain} type="button" onClick={onEdit}>
        <span className={task.status === 'done' ? styles.taskTitleDone : styles.taskTitle}>{task.title}</span>
        {task.description && <span className={styles.taskDescription}>{task.description}</span>}
        <span className={styles.taskMeta}>
          {task.dueDate && (
            <span className={`${styles.due} ${dueClass}`}>
              <CalendarDays size={14} />
              {formatDueDate(task.dueDate, today)}
            </span>
          )}
          <span className={`${styles.priority} ${priorityClass}`}>{priorityLabels[task.priority]}優先</span>
          {task.status === 'in_progress' && <span className={styles.statusBadge}>進行中</span>}
        </span>
      </button>
      <div className={styles.taskActions}>
        <button type="button" title="編集" aria-label={`${task.title}を編集`} onClick={onEdit} disabled={busy}><Pencil size={16} /></button>
        <button type="button" title="削除" aria-label={`${task.title}を削除`} onClick={onDelete} disabled={busy}><Trash2 size={16} /></button>
      </div>
    </article>
  );
}

function TaskListSkeleton(): JSX.Element {
  return (
    <div className={styles.taskList} aria-label="読み込み中">
      {[1, 2, 3].map((item) => (
        <div className={styles.skeletonCard} key={item}>
          <span /><div><span /><span /><span /></div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasTasks, filter, query, onCreate }: { hasTasks: boolean; filter: TaskFilter; query: string; onCreate: () => void }): JSX.Element {
  const title = query
    ? '一致するタスクがありません'
    : hasTasks && filter !== 'allTasks'
      ? 'このビューにはタスクがありません'
      : '最初のタスクを追加しましょう';
  const message = query
    ? '検索語を変えるか、検索をクリアしてみてください。'
    : hasTasks && filter !== 'allTasks'
      ? '別のビューを選ぶと、登録済みのタスクを確認できます。'
      : '頭の中にある「次にやること」を、まずひとつ書き出してみましょう。';
  return (
    <div className={styles.stateCard}>
      <div className={styles.emptyIcon}><CheckCircle2 size={25} /></div>
      <h3>{title}</h3>
      <p>{message}</p>
      {!query && (!hasTasks || filter === 'allTasks') && <button className={styles.primaryButton} type="button" onClick={onCreate}><Plus size={17} />タスクを追加</button>}
    </div>
  );
}

interface TaskDraft {
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
}

function TaskEditorModal({ task, isSaving, onClose, onSubmit }: { task: Task | null; isSaving: boolean; onClose: () => void; onSubmit: (input: TaskInput) => void }): JSX.Element {
  const [draft, setDraft] = useState<TaskDraft>(() => toDraft(task));
  const [validationError, setValidationError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(toDraft(task));
    setValidationError(null);
    titleRef.current?.focus();
  }, [task]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape' && !isSaving) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!draft.title.trim()) {
      setValidationError('タスク名を入力してください。');
      titleRef.current?.focus();
      return;
    }
    onSubmit({
      title: draft.title.trim(),
      description: draft.description.trim(),
      dueDate: draft.dueDate || null,
      priority: draft.priority,
      status: draft.status,
    });
  }

  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.modalKicker}>{task ? 'EDIT TASK' : 'NEW TASK'}</p>
            <h2 id="task-editor-title">{task ? 'タスクを編集' : '新しいタスク'}</h2>
          </div>
          <button className={styles.closeButton} type="button" aria-label="閉じる" onClick={onClose} disabled={isSaving}><X size={19} /></button>
        </div>
        <form className={styles.editorForm} onSubmit={submit}>
          <label>
            タスク名
            <input ref={titleRef} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} maxLength={200} placeholder="例：資料を確認して返信する" />
          </label>
          <label>
            メモ <span className={styles.optional}>任意</span>
            <textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} maxLength={2_000} placeholder="補足や手順を書いておけます" rows={4} />
          </label>
          <div className={styles.editorGrid}>
            <label>
              期限 <span className={styles.optional}>任意</span>
              <input type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} />
            </label>
            <label>
              優先度
              <select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TaskPriority }))}>
                <option value="high">高優先</option>
                <option value="medium">中優先</option>
                <option value="low">低優先</option>
              </select>
            </label>
          </div>
          <label>
            ステータス
            <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as TaskStatus }))}>
              <option value="todo">{statusLabels.todo}</option>
              <option value="in_progress">{statusLabels.in_progress}</option>
              <option value="done">{statusLabels.done}</option>
            </select>
          </label>
          {validationError && <p className={styles.validationError} role="alert">{validationError}</p>}
          <div className={styles.modalActions}>
            <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={isSaving}>キャンセル</button>
            <button className={styles.primaryButton} type="submit" disabled={isSaving}>{isSaving ? '保存中…' : '保存する'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toDraft(task: Task | null): TaskDraft {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    dueDate: task?.dueDate ?? '',
    priority: task?.priority ?? 'medium',
    status: task?.status ?? 'todo',
  };
}

function formatDueDate(value: string, today: string): string {
  if (value === today) return '今日';
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'UTC', month: 'short', day: 'numeric', weekday: 'short' }).format(date);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
