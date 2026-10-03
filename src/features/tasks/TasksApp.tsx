import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, CheckCircle2, ChevronDown, House, LogOut, Pencil, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { tasksApi, todayJst, type Task, type TaskInput, type TaskPriority, type TaskStatus } from './apiClient';
import styles from './TasksApp.module.css';

interface TasksAppProps {
  onLogout: () => void;
}

type NotebookFilter = 'pending' | 'done' | 'all';
type NotebookSort = 'manual' | 'created-desc' | 'title-asc' | 'due-asc' | 'priority-desc';

interface TaskUpsertRequest {
  id?: string;
  input: TaskInput;
}

const filterLabels: Record<NotebookFilter, string> = {
  pending: '未完了',
  done: '完了',
  all: 'すべて',
};

const priorityLabels: Record<TaskPriority, string> = {
  low: '低優先',
  medium: '中優先',
  high: '高優先',
};

const statusLabels: Record<TaskStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  done: '完了',
};

const sortLabels: Record<NotebookSort, string> = {
  manual: '入力順',
  'created-desc': '新しい順',
  'title-asc': '名前順',
  'due-asc': '期限順',
  'priority-desc': '優先度順',
};

const priorityRank: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
const DEFAULT_TASK_CATEGORY = '未分類';

const EMPTY_TASKS: Task[] = [];

export function TasksApp({ onLogout }: TasksAppProps): JSX.Element {
  const queryClient = useQueryClient();
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: tasksApi.list });
  const [filter, setFilter] = useState<NotebookFilter>('pending');
  const [sort, setSort] = useState<NotebookSort>('manual');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [query, setQuery] = useState('');
  const [newLines, setNewLines] = useState('');
  const [operationError, setOperationError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const today = useMemo(() => todayJst(), []);
  const tasks = tasksQuery.data?.tasks ?? EMPTY_TASKS;
  const categories = useMemo(
    () => [...new Set(tasks.map((task) => task.category.trim() || DEFAULT_TASK_CATEGORY))].sort((left, right) => left.localeCompare(right, 'ja')),
    [tasks],
  );
  useEffect(() => {
    if (categoryFilter && !categories.includes(categoryFilter)) setCategoryFilter('');
  }, [categories, categoryFilter]);
  const pendingCount = tasks.filter((task) => task.status !== 'done').length;
  const doneCount = tasks.length - pendingCount;
  const matchingTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return tasks
      .map((task, originalIndex) => ({ task, originalIndex }))
      .filter(({ task }) => {
        if (filter === 'pending' && task.status === 'done') return false;
        if (filter === 'done' && task.status !== 'done') return false;
        if (categoryFilter && (task.category || DEFAULT_TASK_CATEGORY) !== categoryFilter) return false;
        return !normalizedQuery || `${task.title} ${task.category} ${task.description}`.toLocaleLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => compareTasks(left, right, sort))
      .map(({ task }) => task);
  }, [categoryFilter, filter, query, sort, tasks]);

  const upsertMutation = useMutation({
    mutationFn: async (requests: TaskUpsertRequest[]) => {
      const failedRequests: TaskUpsertRequest[] = [];
      // Process in order so new rows keep the order in which they were entered.
      for (const request of requests) {
        try {
          if (request.id) await tasksApi.update(request.id, request.input);
          else await tasksApi.create(request.input);
        } catch {
          failedRequests.push(request);
        }
      }
      return { failedRequests, succeededCount: requests.length - failedRequests.length };
    },
    onSuccess: async ({ failedRequests, succeededCount }, requests) => {
      if (succeededCount > 0) await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      const hasNewRows = requests.some((request) => !request.id);
      if (hasNewRows) setNewLines(failedRequests.filter((request) => !request.id).map((request) => request.input.title).join('\n'));
      setOperationError(failedRequests.length === 0
        ? null
        : hasNewRows
          ? `${failedRequests.length}/${requests.length}行を追加できませんでした。残った行を確認してください。`
          : 'タスクを保存できませんでした。入力内容と通信状態を確認してください。');
    },
    onError: (error: unknown) => setOperationError(getErrorMessage(error, 'タスクを保存できませんでした。')),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) => tasksApi.update(task.id, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setOperationError(null);
    },
    onError: (error: unknown) => setOperationError(getErrorMessage(error, 'チェック状態を保存できませんでした。')),
  });

  const removeMutation = useMutation({
    mutationFn: (task: Task) => tasksApi.remove(task.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setOperationError(null);
    },
    onError: (error: unknown) => setOperationError(getErrorMessage(error, 'タスクを削除できませんでした。')),
  });

  useLayoutEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [newLines]);

  function addLines(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (upsertMutation.isPending) return;

    const titles = newLines.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (titles.length === 0) return;
    if (titles.some((title) => title.length > 200)) {
      setOperationError('1行のタスク名は200文字以内で入力してください。');
      return;
    }
    setOperationError(null);
    upsertMutation.mutate(titles.map((title) => ({
      input: { title, category: DEFAULT_TASK_CATEGORY, description: '', dueDate: null, priority: 'medium', status: 'todo' },
    })));
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function saveTask(task: Task, input: TaskInput): void {
    if (upsertMutation.isPending) return;
    setOperationError(null);
    upsertMutation.mutate([{ id: task.id, input }]);
  }

  function toggleTask(task: Task): void {
    if (toggleMutation.isPending) return;
    toggleMutation.mutate({ task, status: task.status === 'done' ? 'todo' : 'done' });
  }

  function deleteTask(task: Task): void {
    if (removeMutation.isPending) return;
    if (window.confirm(`「${task.title}」を削除しますか？`)) removeMutation.mutate(task);
  }

  const queryError = tasksQuery.error instanceof Error ? tasksQuery.error.message : null;
  const filterCounts: Record<NotebookFilter, number> = {
    pending: pendingCount,
    done: doneCount,
    all: tasks.length,
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Link className={styles.homeButton} to="/" aria-label="ホームに戻る"><House size={18} /></Link>
            <div>
              <p className={styles.kicker}>PERSONAL TASKS</p>
              <h1>やることメモ</h1>
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
        <section className={styles.pageIntro}>
          <div>
            <p className={styles.eyebrow}>ONE LINE, ONE TASK</p>
            <h2>思いついたことを、そのまま一行に。</h2>
            <p>一行につきタスクひとつ。チェックを入れると完了です。</p>
          </div>
          <time className={styles.today} dateTime={today}>{formatNotebookDate(today)}</time>
        </section>

        <section className={styles.notebook} aria-label="タスクメモ">
          <div className={styles.notebookToolbar}>
            <nav className={styles.filterTabs} aria-label="表示するタスク">
              {(Object.keys(filterLabels) as NotebookFilter[]).map((key) => (
                <button
                  className={filter === key ? styles.filterActive : styles.filterButton}
                  type="button"
                  key={key}
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                >
                  {filterLabels[key]} <span>{filterCounts[key]}</span>
                </button>
              ))}
            </nav>
            <div className={styles.toolbarTools}>
              <label className={styles.categoryBox}>
                <span>カテゴリ</span>
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                  <option value="">全カテゴリ</option>
                  {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </label>
              <label className={styles.sortBox}>
                <span>並び順</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as NotebookSort)}>
                  {(Object.keys(sortLabels) as NotebookSort[]).map((key) => <option key={key} value={key}>{sortLabels[key]}</option>)}
                </select>
              </label>
              <label className={styles.searchBox}>
                <Search size={16} aria-hidden="true" />
                <span className={styles.srOnly}>タスクを検索</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="検索" />
                {query && <button type="button" aria-label="検索をクリア" onClick={() => setQuery('')}><X size={15} /></button>}
              </label>
            </div>
          </div>

          {operationError && <p className={styles.errorMessage} role="alert">{operationError}</p>}
          {tasksQuery.isLoading && <TaskListSkeleton />}
          {!tasksQuery.isLoading && queryError && (
            <div className={styles.stateCard}>
              <AlertCircle size={23} />
              <h3>メモを読み込めませんでした</h3>
              <p>{queryError}</p>
              <button className={styles.secondaryButton} type="button" onClick={() => void tasksQuery.refetch()}>再読み込み</button>
            </div>
          )}
          {!tasksQuery.isLoading && !queryError && (
            <div className={styles.notebookPaper}>
              {matchingTasks.length > 0 ? (
                <div className={styles.taskList}>
                  {matchingTasks.map((task) => (
                    <TaskLine
                      key={task.id}
                      task={task}
                      today={today}
                      onToggle={() => toggleTask(task)}
                      onSave={(input) => saveTask(task, input)}
                      onDelete={() => deleteTask(task)}
                      busy={toggleMutation.isPending || removeMutation.isPending || upsertMutation.isPending}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.emptyLine}>
                  <span className={styles.emptyCheck} aria-hidden="true" />
                  <span>{query ? '一致するタスクはありません。' : 'まだ何も書かれていません。下の欄から追加できます。'}</span>
                </div>
              )}

              <form className={styles.composer} onSubmit={addLines}>
                <span className={styles.composerCheck} aria-hidden="true" />
                <label className={styles.srOnly} htmlFor="new-task-lines">新しいタスク。1行につき1件入力</label>
                <textarea
                  id="new-task-lines"
                  ref={composerRef}
                  value={newLines}
                  onChange={(event) => setNewLines(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="ここに入力（1行につき1タスク）"
                  rows={1}
                  maxLength={10_000}
                  disabled={upsertMutation.isPending}
                />
                <button className={styles.saveButton} type="submit" title="入力した行を追加" aria-label="入力した行を追加" disabled={!newLines.trim() || upsertMutation.isPending}>
                  <Pencil size={17} />
                </button>
                <span className={styles.composerHint}>{upsertMutation.isPending ? '保存中…' : '鉛筆を押すと、1行ずつタスクとして追加されます'}</span>
              </form>
            </div>
          )}
        </section>

        {!tasksQuery.isLoading && !queryError && (
          <p className={styles.footerNote}>
            <CheckCircle2 size={15} />
            {pendingCount === 0 ? '未完了のタスクはありません' : `${pendingCount}件のタスクが残っています`}
          </p>
        )}
      </main>

    </div>
  );
}

function compareTasks(
  left: { task: Task; originalIndex: number },
  right: { task: Task; originalIndex: number },
  sort: NotebookSort,
): number {
  let order = 0;
  if (sort === 'created-desc') order = right.task.createdAt - left.task.createdAt;
  if (sort === 'title-asc') order = left.task.title.localeCompare(right.task.title, 'ja');
  if (sort === 'due-asc') {
    if (!left.task.dueDate && right.task.dueDate) order = 1;
    else if (left.task.dueDate && !right.task.dueDate) order = -1;
    else if (left.task.dueDate && right.task.dueDate) order = left.task.dueDate.localeCompare(right.task.dueDate);
  }
  if (sort === 'priority-desc') order = priorityRank[left.task.priority] - priorityRank[right.task.priority];
  return order || left.originalIndex - right.originalIndex;
}

function TaskLine({
  task,
  today,
  onToggle,
  onSave,
  onDelete,
  busy,
}: {
  task: Task;
  today: string;
  onToggle: () => void;
  onSave: (input: TaskInput) => void;
  onDelete: () => void;
  busy: boolean;
}): JSX.Element {
  const [draft, setDraft] = useState<TaskDraft>(() => toTaskDraft(task));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsId = `task-details-${task.id}`;

  useEffect(() => setDraft(toTaskDraft(task)), [task.id, task.title, task.description, task.dueDate, task.priority, task.status]);

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') event.preventDefault();
    if (event.key === 'Escape') setDraft((current) => ({ ...current, title: task.title }));
  }

  const hasChanges = draft.title.trim() !== task.title
    || (draft.category.trim() || DEFAULT_TASK_CATEGORY) !== task.category
    || draft.description.trim() !== task.description
    || (draft.dueDate || null) !== task.dueDate
    || draft.priority !== task.priority
    || draft.status !== task.status;
  const hasDetails = task.category !== DEFAULT_TASK_CATEGORY || Boolean(task.dueDate) || task.priority !== 'medium' || task.status === 'in_progress';

  function save(): void {
    if (!draft.title.trim()) return;
    if (!hasChanges || busy) return;
    onSave({
      title: draft.title.trim(),
      category: draft.category.trim() || DEFAULT_TASK_CATEGORY,
      description: draft.description.trim(),
      dueDate: draft.dueDate || null,
      priority: draft.priority,
      status: draft.status,
    });
  }

  return (
    <article className={task.status === 'done' ? styles.taskLineDone : styles.taskLine}>
      <button
        className={task.status === 'done' ? styles.checkButtonDone : styles.checkButton}
        type="button"
        aria-label={task.status === 'done' ? `${task.title}を未完了に戻す` : `${task.title}を完了にする`}
        aria-pressed={task.status === 'done'}
        onClick={onToggle}
        title={hasChanges ? '編集内容を保存してからチェックできます' : undefined}
        disabled={busy || hasChanges}
      >
        {task.status === 'done' && <Check size={17} strokeWidth={3} />}
      </button>
      <div className={styles.taskTextGroup}>
        <input
          className={task.status === 'done' ? styles.taskTitleDone : styles.taskTitle}
          aria-label={`${task.title}を編集`}
          value={draft.title}
          maxLength={200}
          onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          onKeyDown={handleTitleKeyDown}
          disabled={busy}
        />
        {hasDetails && (
          <span className={styles.taskMeta}>
            {task.category !== DEFAULT_TASK_CATEGORY && <span>カテゴリ: {task.category}</span>}
            {task.dueDate && <span>期限: {formatDueDate(task.dueDate, today)}</span>}
            {task.priority !== 'medium' && <span>{priorityLabels[task.priority]}</span>}
            {task.status === 'in_progress' && <span>{statusLabels.in_progress}</span>}
          </span>
        )}
      </div>
      <div className={styles.taskActions}>
        <button
          className={detailsOpen ? styles.accordionButtonOpen : styles.accordionButton}
          type="button"
          title={detailsOpen ? '詳細を閉じる' : '詳細を開く'}
          aria-label={`${task.title}の詳細を${detailsOpen ? '閉じる' : '開く'}`}
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <ChevronDown size={17} />
        </button>
        <button
          className={styles.taskSaveButton}
          type="button"
          title="変更を保存"
          aria-label={`${task.title}の変更を保存`}
          onClick={save}
          disabled={!hasChanges || busy || !draft.title.trim()}
        >
          <Pencil size={15} />
        </button>
        <button type="button" title="削除" aria-label={`${task.title}を削除`} onClick={onDelete} disabled={busy}><Trash2 size={15} /></button>
      </div>
      <div className={styles.taskDetails} id={detailsId} hidden={!detailsOpen}>
        <h3>詳細</h3>
        <div className={styles.detailsGrid}>
          <label className={styles.detailsField}>
            カテゴリ
            <input
              type="text"
              value={draft.category}
              maxLength={40}
              placeholder={DEFAULT_TASK_CATEGORY}
              onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
              disabled={busy}
            />
          </label>
          <label className={styles.detailsField}>
            期限
            <input
              type="date"
              value={draft.dueDate}
              onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
              disabled={busy}
            />
          </label>
          <label className={styles.detailsField}>
            優先度
            <select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TaskPriority }))} disabled={busy}>
              <option value="high">高優先</option>
              <option value="medium">中優先</option>
              <option value="low">低優先</option>
            </select>
          </label>
          <label className={styles.detailsField}>
            ステータス
            <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as TaskStatus }))} disabled={busy}>
              <option value="todo">{statusLabels.todo}</option>
              <option value="in_progress">{statusLabels.in_progress}</option>
              <option value="done">{statusLabels.done}</option>
            </select>
          </label>
        </div>
        <label className={styles.detailsField}>
          メモ
          <textarea
            value={draft.description}
            maxLength={2_000}
            rows={3}
            placeholder="補足や手順"
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            disabled={busy}
          />
        </label>
      </div>
    </article>
  );
}

function TaskListSkeleton(): JSX.Element {
  return (
    <div className={styles.loadingPaper} aria-label="読み込み中">
      {[1, 2, 3, 4].map((item) => (
        <div className={styles.skeletonLine} key={item}>
          <span />
          <i />
        </div>
      ))}
    </div>
  );
}

interface TaskDraft {
  title: string;
  category: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
}

function toTaskDraft(task: Task): TaskDraft {
  return {
    title: task.title,
    category: task.category || DEFAULT_TASK_CATEGORY,
    description: task.description,
    dueDate: task.dueDate ?? '',
    priority: task.priority,
    status: task.status,
  };
}

function formatDueDate(value: string, today: string): string {
  if (value === today) return '今日が期限';
  const date = new Date(`${value}T00:00:00Z`);
  return `${new Intl.DateTimeFormat('ja-JP', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(date)}が期限`;
}

function formatNotebookDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(date);
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
