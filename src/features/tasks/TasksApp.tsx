import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, CheckCircle2, House, LogOut, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { tasksApi, todayJst, type Task, type TaskInput, type TaskPriority, type TaskStatus } from './apiClient';
import styles from './TasksApp.module.css';

interface TasksAppProps {
  onLogout: () => void;
}

type NotebookFilter = 'pending' | 'done' | 'all';

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

const EMPTY_TASKS: Task[] = [];

export function TasksApp({ onLogout }: TasksAppProps): JSX.Element {
  const queryClient = useQueryClient();
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: tasksApi.list });
  const [filter, setFilter] = useState<NotebookFilter>('pending');
  const [query, setQuery] = useState('');
  const [newLines, setNewLines] = useState('');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const today = useMemo(() => todayJst(), []);
  const tasks = tasksQuery.data?.tasks ?? EMPTY_TASKS;
  const pendingCount = tasks.filter((task) => task.status !== 'done').length;
  const doneCount = tasks.length - pendingCount;
  const matchingTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return tasks.filter((task) => {
      if (filter === 'pending' && task.status === 'done') return false;
      if (filter === 'done' && task.status !== 'done') return false;
      return !normalizedQuery || `${task.title} ${task.description}`.toLocaleLowerCase().includes(normalizedQuery);
    });
  }, [filter, query, tasks]);

  const addMutation = useMutation({
    mutationFn: async (titles: string[]) => {
      const failedTitles: string[] = [];
      // Create in sequence so the stored notebook order follows the entered lines.
      for (const title of titles) {
        try {
          await tasksApi.create({ title, description: '', dueDate: null, priority: 'medium', status: 'todo' });
        } catch {
          failedTitles.push(title);
        }
      }
      return { failedTitles, attemptedCount: titles.length };
    },
    onSuccess: async ({ failedTitles, attemptedCount }) => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setNewLines(failedTitles.join('\n'));
      setOperationError(failedTitles.length > 0
        ? `${failedTitles.length}/${attemptedCount}行を追加できませんでした。残った行を確認してください。`
        : null);
    },
    onError: (error: unknown) => setOperationError(getErrorMessage(error, 'タスクの追加に失敗しました。')),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskInput }) => tasksApi.update(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setEditingTask(null);
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
    if (addMutation.isPending) return;

    const titles = newLines.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (titles.length === 0) return;
    if (titles.some((title) => title.length > 200)) {
      setOperationError('1行のタスク名は200文字以内で入力してください。');
      return;
    }
    setOperationError(null);
    addMutation.mutate(titles);
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function saveTitle(task: Task, title: string): void {
    const normalizedTitle = title.trim();
    if (!normalizedTitle || normalizedTitle === task.title || saveMutation.isPending) return;
    saveMutation.mutate({ id: task.id, input: { title: normalizedTitle } });
  }

  function openDetails(task: Task): void {
    setOperationError(null);
    setEditingTask(task);
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
            <label className={styles.searchBox}>
              <Search size={16} aria-hidden="true" />
              <span className={styles.srOnly}>タスクを検索</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="検索" />
              {query && <button type="button" aria-label="検索をクリア" onClick={() => setQuery('')}><X size={15} /></button>}
            </label>
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
                      onSaveTitle={(title) => saveTitle(task, title)}
                      onEdit={() => openDetails(task)}
                      onDelete={() => deleteTask(task)}
                      busy={toggleMutation.isPending || removeMutation.isPending}
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
                <span className={styles.composerMark} aria-hidden="true"><Plus size={18} /></span>
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
                  disabled={addMutation.isPending}
                />
                <button className={styles.addButton} type="submit" disabled={!newLines.trim() || addMutation.isPending}>
                  <Plus size={16} />{addMutation.isPending ? '追加中…' : '追加'}
                </button>
                <span className={styles.composerHint}>複数行もまとめて追加できます</span>
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

      {editingTask && (
        <TaskEditorModal
          task={editingTask}
          isSaving={saveMutation.isPending}
          onClose={() => { if (!saveMutation.isPending) setEditingTask(null); }}
          onSubmit={(input) => saveMutation.mutate({ id: editingTask.id, input })}
        />
      )}
    </div>
  );
}

function TaskLine({
  task,
  today,
  onToggle,
  onSaveTitle,
  onEdit,
  onDelete,
  busy,
}: {
  task: Task;
  today: string;
  onToggle: () => void;
  onSaveTitle: (title: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}): JSX.Element {
  const [title, setTitle] = useState(task.title);

  useEffect(() => setTitle(task.title), [task.id, task.title]);

  function commitTitle(): void {
    if (!title.trim()) {
      setTitle(task.title);
      return;
    }
    onSaveTitle(title);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setTitle(task.title);
      event.currentTarget.blur();
    }
  }

  const hasDetails = Boolean(task.dueDate) || task.priority !== 'medium' || task.status === 'in_progress';

  return (
    <article className={task.status === 'done' ? styles.taskLineDone : styles.taskLine}>
      <button
        className={task.status === 'done' ? styles.checkButtonDone : styles.checkButton}
        type="button"
        aria-label={task.status === 'done' ? `${task.title}を未完了に戻す` : `${task.title}を完了にする`}
        aria-pressed={task.status === 'done'}
        onClick={onToggle}
        disabled={busy}
      >
        {task.status === 'done' && <Check size={17} strokeWidth={3} />}
      </button>
      <div className={styles.taskTextGroup}>
        <input
          className={task.status === 'done' ? styles.taskTitleDone : styles.taskTitle}
          aria-label={`${task.title}を編集`}
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={handleTitleKeyDown}
        />
        {hasDetails && (
          <span className={styles.taskMeta}>
            {task.dueDate && <span>{formatDueDate(task.dueDate, today)}</span>}
            {task.priority !== 'medium' && <span>{priorityLabels[task.priority]}</span>}
            {task.status === 'in_progress' && <span>{statusLabels.in_progress}</span>}
          </span>
        )}
      </div>
      <div className={styles.taskActions}>
        <button type="button" title="詳細を編集" aria-label={`${task.title}の詳細を編集`} onClick={onEdit} disabled={busy}><Pencil size={15} /></button>
        <button type="button" title="削除" aria-label={`${task.title}を削除`} onClick={onDelete} disabled={busy}><Trash2 size={15} /></button>
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
  description: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
}

function TaskEditorModal({ task, isSaving, onClose, onSubmit }: { task: Task; isSaving: boolean; onClose: () => void; onSubmit: (input: TaskInput) => void }): JSX.Element {
  const [draft, setDraft] = useState<TaskDraft>(() => toDraft(task));
  const [validationError, setValidationError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(toDraft(task));
    setValidationError(null);
    titleRef.current?.focus();
  }, [task]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape' && !isSaving) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  useLayoutEffect(() => {
    const textarea = descriptionRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft.description]);

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
            <p className={styles.modalKicker}>TASK DETAILS</p>
            <h2 id="task-editor-title">タスクの詳細</h2>
          </div>
          <button className={styles.closeButton} type="button" aria-label="閉じる" onClick={onClose} disabled={isSaving}><X size={19} /></button>
        </div>
        <form className={styles.editorForm} onSubmit={submit}>
          <label>
            タスク名
            <input ref={titleRef} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} maxLength={200} />
          </label>
          <label>
            メモ <span className={styles.optional}>任意</span>
            <textarea ref={descriptionRef} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} maxLength={2_000} placeholder="補足や手順" rows={1} />
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

function toDraft(task: Task): TaskDraft {
  return {
    title: task.title,
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
