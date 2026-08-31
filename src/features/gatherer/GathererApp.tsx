import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FilePlus2,
  HelpCircle,
  House,
  ListChecks,
  ListTodo,
  LogOut,
  Newspaper,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  RotateCw,
  Save,
  Trash2,
} from 'lucide-react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  formatPublishedAt,
  gathererApi,
  type Item,
  type Provider,
  type Source,
  type Task,
  type TaskLog,
  todayJst,
} from './apiClient';
import styles from './GathererApp.module.css';

interface GathererAppProps {
  onLogout: () => void;
}

export function GathererApp({ onLogout }: GathererAppProps): JSX.Element {
  return (
    <div className={styles.app}>
      <GathererHeader onLogout={onLogout} />
      <main className={styles.main}>
        <Routes>
          <Route index element={<TodayPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="add" element={<SourceEditorPage />} />
          <Route path="sources" element={<SourcesPage />} />
          <Route path="sources/:sourceId" element={<SourceEditorPage />} />
          <Route path="runs" element={<RunsPage />} />
          <Route path="guide" element={<GuidePage />} />
          <Route path="*" element={<TodayPage />} />
        </Routes>
      </main>
    </div>
  );
}

function GathererHeader({ onLogout }: GathererAppProps): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const title = path.includes('/tasks')
    ? 'タスク記録'
    : path.includes('/add')
      ? '情報源を追加'
      : path.includes('/guide')
        ? '記事収集の使い方'
        : path.includes('/runs')
          ? '収集実行履歴'
          : path.includes('/sources')
            ? '情報源'
            : '今日の収集結果';

  return (
    <header className={styles.header}>
      <div>
        <p className={styles.kicker}>GATHERER</p>
        <h1>{title}</h1>
      </div>
      <div className={styles.headerActions}>
        <Link className={styles.iconButton} to="/" title="ホーム" aria-label="ホームに戻る">
          <House size={19} />
        </Link>
        <button className={styles.iconButton} type="button" title="使い方" aria-label="使い方" onClick={() => navigate('/gatherer/guide')}>
          <HelpCircle size={19} />
        </button>
        <button className={styles.iconButton} type="button" title="ログアウト" aria-label="ログアウト" onClick={onLogout}>
          <LogOut size={19} />
        </button>
      </div>
      <nav className={styles.nav} aria-label="Gathererメニュー">
        <NavItem to="/gatherer" end icon={<Newspaper size={18} />} label="今日" />
        <NavItem to="/gatherer/tasks" icon={<ListTodo size={18} />} label="タスク" />
        <NavItem to="/gatherer/add" icon={<FilePlus2 size={18} />} label="追加" />
        <NavItem to="/gatherer/sources" icon={<ListChecks size={18} />} label="情報源" />
        <NavItem to="/gatherer/runs" icon={<RotateCw size={18} />} label="履歴" />
      </nav>
    </header>
  );
}

function NavItem({ to, end, icon, label }: { to: string; end?: boolean; icon: JSX.Element; label: string }): JSX.Element {
  return (
    <NavLink className={({ isActive }) => isActive ? styles.navItemActive : styles.navItem} to={to} end={end}>
      {icon}<span>{label}</span>
    </NavLink>
  );
}

type CollectResult = Awaited<ReturnType<typeof gathererApi.collect>>;
const PAGE_SIZE = 10;
const PAGE_WINDOW = 5;

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const halfWindow = Math.floor(PAGE_WINDOW / 2);
  const start = Math.max(1, Math.min(currentPage - halfWindow, totalPages - PAGE_WINDOW + 1));
  const end = Math.min(totalPages, start + PAGE_WINDOW - 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function TodayPage(): JSX.Element {
  const queryClient = useQueryClient();
  const dayKey = useMemo(() => todayJst(), []);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Item | null>(null);
  const [collectResult, setCollectResult] = useState<CollectResult | null>(null);
  const itemsQuery = useQuery({
    queryKey: ['gatherer-items', dayKey, unreadOnly, page, PAGE_SIZE],
    queryFn: () => gathererApi.items(dayKey, unreadOnly, page, PAGE_SIZE),
  });
  const readMutation = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) => gathererApi.setRead(id, read),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gatherer-items'] }),
  });
  const collectMutation = useMutation({
    mutationFn: () => gathererApi.collect(dayKey),
    onMutate: () => setCollectResult(null),
    onSuccess: async (result) => {
      setCollectResult(result);
      await queryClient.invalidateQueries({ queryKey: ['gatherer-items'] });
      await queryClient.invalidateQueries({ queryKey: ['gatherer-runs'] });
    },
  });
  const total = itemsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visiblePages = getVisiblePages(page, totalPages);
  const items = itemsQuery.data?.items ?? [];
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(total, page * PAGE_SIZE);
  const collectError = collectMutation.error instanceof Error ? collectMutation.error.message : '';
  const collectMessage = collectResult
    ? collectResult.status === 'fail'
      ? `収集できませんでした。${collectResult.skipped}件は条件不一致でした。`
      : `${collectResult.inserted}件を追加、${collectResult.reused}件の既存結果を今日に反映しました。${collectResult.skipped}件は条件不一致でした。`
    : '';

  useEffect(() => {
    setPage(1);
  }, [dayKey, unreadOnly]);

  useEffect(() => {
    if (!itemsQuery.data || page <= totalPages) return;
    setPage(totalPages);
  }, [itemsQuery.data, page, totalPages]);

  return (
    <section className={styles.page}>
      <div className={styles.toolbar}>
        <button className={styles.secondaryButton} type="button" onClick={() => void itemsQuery.refetch()}>
          <RefreshCw size={17} />更新
        </button>
        <button className={styles.primaryButton} type="button" disabled={collectMutation.isPending} onClick={() => collectMutation.mutate()}>
          <RotateCw size={17} />{collectMutation.isPending ? '収集中' : '手動収集'}
        </button>
      </div>
      <label className={styles.checkbox}>
        <input type="checkbox" checked={unreadOnly} onChange={(event) => { setUnreadOnly(event.target.checked); setPage(1); }} />
        未読のみ
      </label>
      {collectError && <p className={styles.error}>手動収集に失敗しました: {collectError}</p>}
      {collectMessage && (
        <div className={collectResult?.status === 'fail' ? styles.error : styles.notice}>
          <p>{collectMessage}</p>
          {collectResult?.failures.length ? <ul className={styles.failures}>{collectResult.failures.map((failure) => <li key={failure}>{failure}</li>)}</ul> : null}
        </div>
      )}
      {itemsQuery.isLoading && <p className={styles.muted}>読み込み中…</p>}
      {itemsQuery.error instanceof Error && <p className={styles.error}>{itemsQuery.error.message}</p>}
      {!itemsQuery.isLoading && items.length === 0 && (
        <div className={styles.empty}><h2>今日の結果はまだありません</h2><p>情報源を登録して収集を実行すると、ここに結果が表示されます。</p></div>
      )}
      <div className={styles.itemList}>
        {items.map((item) => (
          <article className={item.read ? styles.itemRead : styles.item} key={item.id} onClick={() => setSelected(item)}>
            <div className={styles.itemMeta}><span>{item.source_title}</span><time>{formatPublishedAt(item.published_at)}</time></div>
            <h2>{item.title}</h2>
            <p>{item.summary || '本文抜粋はありません。'}</p>
            <div className={styles.itemActions}>
              <span>score {item.score}</span>
              <button type="button" onClick={(event) => { event.stopPropagation(); readMutation.mutate({ id: item.id, read: !item.read }); }}>
                <Check size={15} />{item.read ? '未読へ' : '既読へ'}
              </button>
            </div>
          </article>
        ))}
      </div>
      {total > PAGE_SIZE && <nav className={styles.pagination} aria-label="収集結果のページ">
        <button className={styles.secondaryButton} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || itemsQuery.isFetching}><ChevronLeft size={17} />前へ</button>
        <div className={styles.pageSummary}>
          <p><strong>{page}</strong> / {totalPages} <span>{pageStart}-{pageEnd}件目 / {total}件</span></p>
          <div className={styles.pageNumbers}>
            {visiblePages[0] > 1 && <><button type="button" onClick={() => setPage(1)} disabled={itemsQuery.isFetching}>1</button>{visiblePages[0] > 2 && <span aria-hidden="true">…</span>}</>}
            {visiblePages.map((pageNumber) => <button className={pageNumber === page ? styles.pageNumberActive : undefined} key={pageNumber} type="button" onClick={() => setPage(pageNumber)} disabled={pageNumber === page || itemsQuery.isFetching} aria-current={pageNumber === page ? 'page' : undefined}>{pageNumber}</button>)}
            {visiblePages[visiblePages.length - 1] < totalPages && <>{visiblePages[visiblePages.length - 1] < totalPages - 1 && <span aria-hidden="true">…</span>}<button type="button" onClick={() => setPage(totalPages)} disabled={itemsQuery.isFetching}>{totalPages}</button></>}
          </div>
        </div>
        <button className={styles.secondaryButton} type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || itemsQuery.isFetching}>次へ<ChevronRight size={17} /></button>
      </nav>}
      {selected && <div className={styles.backdrop} onClick={() => setSelected(null)}>
        <aside className={styles.sheet} onClick={(event) => event.stopPropagation()}>
          <h2>{selected.title}</h2><p>{selected.summary || '本文抜粋はありません。'}</p>
          <a className={styles.primaryButton} href={selected.url} target="_blank" rel="noreferrer"><ExternalLink size={17} />リンクを開く</a>
          <button className={styles.secondaryButton} type="button" onClick={() => { readMutation.mutate({ id: selected.id, read: !selected.read }); setSelected(null); }}>
            <Check size={17} />{selected.read ? '未読に戻す' : '既読にする'}
          </button>
        </aside>
      </div>}
    </section>
  );
}

function SourcesPage(): JSX.Element {
  const queryClient = useQueryClient();
  const sourcesQuery = useQuery({ queryKey: ['gatherer-sources'], queryFn: gathererApi.sources });
  const patchMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: number }) => gathererApi.patchSource(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gatherer-sources'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: gathererApi.deleteSource,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gatherer-sources'] }),
  });
  const sources = sourcesQuery.data?.sources ?? [];
  return (
    <section className={styles.page}>
      <Link className={styles.primaryButton} to="/gatherer/add"><FilePlus2 size={18} />情報源を追加</Link>
      {sourcesQuery.error instanceof Error && <p className={styles.error}>{sourcesQuery.error.message}</p>}
      {!sourcesQuery.isLoading && sources.length === 0 && <div className={styles.empty}><h2>情報源がありません</h2><p>RSS、HTML、JSON API、Tavily検索を登録できます。</p></div>}
      <div className={styles.sourceList}>
        {sources.map((source) => <SourceCard key={source.id} source={source} onToggle={() => patchMutation.mutate({ id: source.id, enabled: source.enabled ? 0 : 1 })} onDelete={() => deleteMutation.mutate(source.id)} />)}
      </div>
    </section>
  );
}

function SourceCard({ source, onToggle, onDelete }: { source: Source; onToggle: () => void; onDelete: () => void }): JSX.Element {
  return <article className={styles.sourceCard}>
    <div><p className={styles.sourceProvider}>{providerLabel(source.provider)}</p><h2><Link to={`/gatherer/sources/${source.id}`}>{source.title}</Link></h2><span className={styles.endpoint}>{source.endpoint}</span></div>
    <div className={styles.cardActions}>
      <Link className={styles.iconButton} to={`/gatherer/sources/${source.id}`} title="編集" aria-label="編集"><Pencil size={17} /></Link>
      <button className={styles.iconButton} type="button" title={source.enabled ? '無効化' : '有効化'} aria-label={source.enabled ? '無効化' : '有効化'} onClick={onToggle}><Power size={17} /></button>
      <button className={styles.iconButton} type="button" title="削除" aria-label="削除" onClick={onDelete}><Trash2 size={17} /></button>
    </div>
  </article>;
}

function SourceEditorPage(): JSX.Element {
  const { sourceId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sourcesQuery = useQuery({ queryKey: ['gatherer-sources'], queryFn: gathererApi.sources });
  const existing = sourcesQuery.data?.sources.find((source) => source.id === sourceId);
  const firstRule = existing?.rules[0];
  const [provider, setProvider] = useState<ProviderInput>(existing?.provider ?? 'auto');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [endpoint, setEndpoint] = useState(existing?.endpoint ?? '');
  const [includeKeywords, setIncludeKeywords] = useState(joinList(firstRule?.include_keywords));
  const [excludeKeywords, setExcludeKeywords] = useState(joinList(firstRule?.exclude_keywords));
  const [regex, setRegex] = useState(firstRule?.regex ?? '');
  const [tags, setTags] = useState(joinList(firstRule?.tags));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!existing) return;
    const rule = existing.rules[0];
    setProvider(existing.provider);
    setTitle(existing.title);
    setEndpoint(existing.endpoint);
    setIncludeKeywords(joinList(rule?.include_keywords));
    setExcludeKeywords(joinList(rule?.exclude_keywords));
    setRegex(rule?.regex ?? '');
    setTags(joinList(rule?.tags));
  }, [existing]);

  function syncFromExisting(source: Source | undefined): void {
    if (!source) return;
    const rule = source.rules[0];
    setProvider(source.provider); setTitle(source.title); setEndpoint(source.endpoint);
    setIncludeKeywords(joinList(rule?.include_keywords)); setExcludeKeywords(joinList(rule?.exclude_keywords));
    setRegex(rule?.regex ?? ''); setTags(joinList(rule?.tags));
  }

  const isEditing = Boolean(sourceId);
  const busy = sourcesQuery.isLoading;
  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError('');
    try {
      const nextProvider = provider === 'auto' ? guessProvider(endpoint) : provider;
      const rule = { include_keywords: splitList(includeKeywords), exclude_keywords: splitList(excludeKeywords), regex: regex.trim() || null, tags: splitList(tags) };
      if (sourceId && existing) {
        await gathererApi.patchSource(sourceId, { provider: nextProvider, title, endpoint });
        if (firstRule) await gathererApi.patchRule(firstRule.id, rule);
        else await gathererApi.createRule(sourceId, rule);
      } else {
        await gathererApi.createSource({ provider: nextProvider, title, endpoint, rule });
      }
      await queryClient.invalidateQueries({ queryKey: ['gatherer-sources'] });
      navigate('/gatherer/sources');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存に失敗しました');
    }
  }

  if (isEditing && !sourcesQuery.isLoading && !existing) return <div className={styles.empty}><h2>情報源が見つかりません</h2></div>;
  return <section className={styles.page}>
    <form className={styles.form} onSubmit={(event) => void onSubmit(event)}>
      {isEditing && existing && <button className={styles.textButton} type="button" onClick={() => syncFromExisting(existing)}>現在の値を再読込</button>}
      <label>取得方法<select value={provider} disabled={busy} onChange={(event) => setProvider(event.target.value as ProviderInput)}>
        <option value="auto">自動判定</option><option value="html">通常のWebページ</option><option value="rss">RSS / Atom</option><option value="json_api">JSON API</option><option value="github_releases">GitHub Releases</option><option value="tavily">Tavily検索</option>
      </select></label>
      <label>タイトル<input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} /></label>
      <label>{provider === 'tavily' ? '検索クエリ' : 'URL'}<input type={provider === 'tavily' ? 'text' : 'url'} value={endpoint} onChange={(event) => setEndpoint(event.target.value)} required /></label>
      <label>含めるキーワード<textarea value={includeKeywords} onChange={(event) => setIncludeKeywords(event.target.value)} placeholder="Cloudflare, React" /></label>
      <label>除外キーワード<textarea value={excludeKeywords} onChange={(event) => setExcludeKeywords(event.target.value)} /></label>
      <label>正規表現<input value={regex} onChange={(event) => setRegex(event.target.value)} /></label>
      <label>タグ<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tech, daily" /></label>
      <div className={styles.preview}>
        <p>プレビュー</p>
        <h2>{title || '未入力のタイトル'}</h2>
        <span>{endpoint || (provider === 'tavily' ? '検索クエリ未入力' : 'URL未入力')}</span>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.primaryButton} type="submit" disabled={busy}><Save size={18} />保存</button>
    </form>
  </section>;
}

const taskColors = ['#2f5d50', '#4969a8', '#a8583f', '#7a5ca8', '#5f7a38'];
const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
type TaskRange = 'recent' | 'month';
type CellMode = 'add' | 'reset';

function dateRange(endDay: string, length: number): string[] {
  return Array.from({ length }, (_, index) => addDays(endDay, index - length + 1));
}

function monthRange(dayKey: string): string[] {
  const [year, month] = dayKey.split('-').map(Number);
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDate = new Date(Date.UTC(year, month, 0));
  return dateRange(lastDate.toISOString().slice(0, 10), lastDate.getUTCDate()).filter((day) => day >= first);
}

function monthCalendarRange(dayKey: string): Array<string | null> {
  const days = monthRange(dayKey);
  const firstWeekday = getWeekday(days[0]);
  const lastWeekday = getWeekday(days[days.length - 1]);
  return [
    ...Array<string | null>(firstWeekday).fill(null),
    ...days,
    ...Array<string | null>(6 - lastWeekday).fill(null),
  ];
}

function getWeekday(dayKey: string): number {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function shortDate(dayKey: string): string {
  const [, month, day] = dayKey.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function dayNumber(dayKey: string): string {
  return String(Number(dayKey.split('-')[2]));
}

function monthLabel(dayKey: string): string {
  const [year, month] = dayKey.split('-');
  return `${year}年${Number(month)}月`;
}

function logKey(taskId: string, dayKey: string): string {
  return `${taskId}:${dayKey}`;
}

function heatStyle(color: string, count: number): React.CSSProperties | undefined {
  if (count === 0) return undefined;
  return { backgroundColor: color, opacity: Math.min(0.18 + count * 0.18, 0.9) };
}

function formatCount(count: number): string {
  return Number.isInteger(count) ? String(count) : count.toFixed(1);
}

function buildLogMap(logs: TaskLog[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const log of logs) map.set(logKey(log.task_id, log.day_key), log.count);
  return map;
}

function taskInitial(label: string): string {
  return label.trim().slice(0, 1) || '?';
}

function TasksPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(taskColors[0]);
  const [range, setRange] = useState<TaskRange>('recent');
  const [cellMode, setCellMode] = useState<CellMode>('add');
  const today = useMemo(() => todayJst(), []);
  const days = useMemo(() => (range === 'month' ? monthRange(today) : dateRange(today, 14)), [range, today]);
  const calendarDays = useMemo(() => monthCalendarRange(today), [today]);
  const from = days[0];
  const to = days[days.length - 1];
  const tasksQuery = useQuery({
    queryKey: ['gatherer-tasks', from, to],
    queryFn: () => gathererApi.tasks(from, to),
  });
  const createMutation = useMutation({
    mutationFn: gathererApi.createTask,
    onSuccess: () => {
      setLabel('');
      void queryClient.invalidateQueries({ queryKey: ['gatherer-tasks'] });
    },
  });
  const incrementMutation = useMutation({
    mutationFn: ({ taskId, dayKey }: { taskId: string; dayKey: string }) =>
      gathererApi.updateTaskLog(taskId, cellMode === 'reset' ? { day_key: dayKey, reset: true } : { day_key: dayKey, delta: 0.5 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gatherer-tasks'] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: Parameters<typeof gathererApi.patchTask>[1] }) =>
      gathererApi.patchTask(taskId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gatherer-tasks'] }),
  });
  const tasks = tasksQuery.data?.tasks ?? [];
  const logs = buildLogMap(tasksQuery.data?.logs ?? []);

  function countFor(taskId: string, dayKey: string): number {
    return logs.get(logKey(taskId, dayKey)) ?? 0;
  }

  function renderTaskLogButton(task: Task, day: string, compact = false): JSX.Element {
    const count = countFor(task.id, day);
    return (
      <button
        className={compact ? styles.calendarTaskButton : styles.cell}
        key={`${task.id}:${day}`}
        type="button"
        aria-label={`${task.label} ${day} ${formatCount(count)}回`}
        title={`${task.label} ${day} ${formatCount(count)}回`}
        onClick={() => incrementMutation.mutate({ taskId: task.id, dayKey: day })}
        disabled={incrementMutation.isPending}
      >
        {compact ? (
          <>
            <span className={styles.calendarTaskDot} style={{ backgroundColor: task.color }} />
            <span className={styles.calendarTaskText}>{count > 0 ? formatCount(count) : taskInitial(task.label)}</span>
          </>
        ) : (
          <>
            <span className={styles.heat} style={heatStyle(task.color, count)} />
            {count > 0 ? <span className={styles.count}>{formatCount(count)}</span> : null}
          </>
        )}
      </button>
    );
  }

  return (
    <section className={styles.page}>
      <form className={styles.taskForm} onSubmit={(event) => { event.preventDefault(); if (label.trim()) createMutation.mutate({ label: label.trim(), color }); }}>
        <input aria-label="タスク名" placeholder="タスクを追加" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} />
        <div className={styles.swatches} role="radiogroup" aria-label="色">
          {taskColors.map((item) => (
            <button className={item === color ? styles.swatchActive : styles.swatch} type="button" role="radio" aria-checked={item === color} aria-label={item} key={item} onClick={() => setColor(item)}>
              <span style={{ backgroundColor: item }} />
            </button>
          ))}
        </div>
        <button className={styles.primaryButton} type="submit" disabled={createMutation.isPending || !label.trim()}><Plus size={18} />追加</button>
      </form>

      {tasksQuery.error instanceof Error && <p className={styles.error}>{tasksQuery.error.message}</p>}
      {createMutation.error instanceof Error && <p className={styles.error}>{createMutation.error.message}</p>}
      {incrementMutation.error instanceof Error && <p className={styles.error}>{incrementMutation.error.message}</p>}
      {updateMutation.error instanceof Error && <p className={styles.error}>{updateMutation.error.message}</p>}

      <div className={styles.taskToolbar}>
        <div className={styles.segmented} role="tablist" aria-label="表示範囲">
          <button className={range === 'recent' ? styles.segmentActive : styles.segment} type="button" onClick={() => setRange('recent')}>14日</button>
          <button className={range === 'month' ? styles.segmentActive : styles.segment} type="button" onClick={() => setRange('month')}>今月</button>
        </div>
        <div className={styles.segmented} role="tablist" aria-label="入力">
          <button className={cellMode === 'add' ? styles.segmentActive : styles.segment} type="button" onClick={() => setCellMode('add')}>+0.5</button>
          <button className={cellMode === 'reset' ? styles.segmentDangerActive : styles.segment} type="button" onClick={() => setCellMode('reset')}>0</button>
        </div>
      </div>

      {!tasksQuery.isLoading && tasks.length === 0 && <div className={styles.empty}><h2>タスクがありません</h2><p>毎日数えたい行動を追加すると、日ごとの回数を記録できます。</p></div>}

      {tasks.length > 0 && (
        <details className={styles.taskAccordion}>
          <summary><span>タスク設定</span><strong>{tasks.length}件</strong><ChevronDown size={18} /></summary>
          <div className={styles.settingsList}>
            {tasks.map((task) => (
              <article className={styles.taskSettings} key={task.id}>
                <input
                  aria-label={`${task.label}の名前`}
                  defaultValue={task.label}
                  key={`${task.id}:${task.label}`}
                  maxLength={80}
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next && next !== task.label) updateMutation.mutate({ taskId: task.id, body: { label: next } });
                    else event.target.value = task.label;
                  }}
                />
                <div className={styles.swatchesCompact} role="radiogroup" aria-label={`${task.label}の色`}>
                  {taskColors.map((item) => (
                    <button className={item === task.color ? styles.swatchActive : styles.swatch} type="button" role="radio" aria-checked={item === task.color} aria-label={item} key={item} onClick={() => { if (item !== task.color) updateMutation.mutate({ taskId: task.id, body: { color: item } }); }} disabled={updateMutation.isPending}>
                      <span style={{ backgroundColor: item }} />
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </details>
      )}

      {tasks.length > 0 && range === 'month' && (
        <div className={styles.calendarWrap}>
          <div className={styles.calendarTitle}>{monthLabel(today)}</div>
          <div className={styles.calendarWeekdays}>{weekDays.map((weekDay) => <div key={weekDay}>{weekDay}</div>)}</div>
          <div className={styles.calendarGrid}>
            {calendarDays.map((day, index) => day ? (
              <div className={day === today ? styles.calendarDayToday : styles.calendarDay} key={day}>
                <div className={styles.calendarDayNumber}>{dayNumber(day)}</div>
                <div className={styles.calendarTasks}>{tasks.map((task) => renderTaskLogButton(task, day, true))}</div>
              </div>
            ) : <div className={styles.calendarBlank} key={`blank:${index}`} aria-hidden="true" />)}
          </div>
        </div>
      )}

      {tasks.length > 0 && range === 'recent' && (
        <div className={styles.gridWrap}>
          <div className={styles.grid} style={{ gridTemplateColumns: `minmax(96px, 1.2fr) repeat(${days.length}, 34px)` }}>
            <div className={styles.corner}>タスク</div>
            {days.map((day) => <div className={day === today ? styles.todayHeader : styles.dayHeader} key={day}>{shortDate(day)}</div>)}
            {tasks.map((task) => (
              <Fragment key={task.id}>
                <div className={styles.taskLabel}>
                  <span style={{ backgroundColor: task.color }} />
                  <strong>{task.label}</strong>
                </div>
                {days.map((day) => renderTaskLogButton(task, day))}
              </Fragment>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function RunsPage(): JSX.Element {
  const runsQuery = useQuery({ queryKey: ['gatherer-runs'], queryFn: gathererApi.runs });
  return <section className={styles.page}>
    <p className={styles.muted}>scheduled()の実行と手動収集の結果を保持します。</p>
    {runsQuery.error instanceof Error && <p className={styles.error}>{runsQuery.error.message}</p>}
    <div className={styles.runList}>{(runsQuery.data?.runs ?? []).map((run) => <article className={styles.runCard} key={run.id}>
      <div><strong>{run.day_key}</strong><span>{run.trigger === 'scheduled' ? '定期実行' : '手動実行'}</span></div>
      <b className={run.status === 'success' ? styles.success : run.status === 'fail' ? styles.failure : styles.partial}>{run.status}</b>
      <p>追加 {run.inserted_count} / 更新 {run.reused_count} / 条件外 {run.skipped_count} / 失敗 {run.failures.length}</p>
    </article>)}</div>
  </section>;
}

function GuidePage(): JSX.Element {
  const sourceTypes = [
    { label: 'RSS / Atom', description: 'ニュース、ブログ、更新情報にRSSがある場合はこれが一番安定します。' },
    { label: '通常のWebページ', description: '記事一覧ページから、同じサイト内の記事らしいリンクを集めます。' },
    { label: 'GitHub Releases', description: 'GitHubのリリース一覧を追いたい時に使います。' },
    { label: 'JSON API', description: '記事や更新情報をJSONで返すAPIを登録する時に使います。' },
    { label: 'Tavily検索', description: 'Tavilyの検索結果を情報源として取り込みます。利用にはAPIキーが必要です。' },
  ];
  return <section className={styles.page}>
    <div className={styles.lead}>
      <h2>記事を集める流れ</h2>
      <p>情報源にURLを登録し、今日画面で手動収集を実行すると、見つかった記事が今日の収集結果に保存されます。</p>
    </div>
    <div className={styles.steps}>
      <GuideCard icon={<FilePlus2 size={20} />} title="1. 情報源を追加" text="「追加」からタイトルとURLを入れて保存します。取得方法は基本的に自動判定で問題ありません。" />
      <GuideCard icon={<ListChecks size={20} />} title="2. 必要なら条件を入れる" text="含めるキーワード、除外キーワード、タグを入れると、保存する記事を絞り込めます。空欄でも収集できます。" />
      <GuideCard icon={<RotateCw size={20} />} title="3. 手動収集を実行" text="「今日」画面の手動収集を押すと、登録済みの情報源を見に行って新しい記事を保存します。" />
      <GuideCard icon={<Newspaper size={20} />} title="4. 今日の結果を読む" text="カードを押すと詳細が開きます。リンクを開くと元記事へ移動し、読んだ記事は既読にできます。" />
    </div>
    <section className={styles.guideSection}>
      <h2>登録するURLの選び方</h2>
      <div className={styles.typeList}>{sourceTypes.map((type) => <article className={styles.typeCard} key={type.label}><h3>{type.label}</h3><p>{type.description}</p></article>)}</div>
    </section>
    <section className={styles.guideSection}>
      <h2>結果が出ない時</h2>
      <ul className={styles.checkList}>
        <li>まずRSSがあるサイトならRSS URLを登録してください。</li>
        <li>通常のWebページは、記事一覧ページのようにリンクが並ぶURLを登録してください。</li>
        <li>ログインが必要なページや、JavaScriptで後から表示される記事一覧は収集できない場合があります。</li>
        <li>キーワード条件を入れている場合、条件に合わない記事は保存されません。</li>
      </ul>
    </section>
    <div className={styles.guideActions}>
      <Link className={styles.primaryAction} to="/gatherer/add"><FilePlus2 size={18} /><span>情報源を追加</span></Link>
      <Link className={styles.secondaryAction} to="/gatherer"><Newspaper size={18} /><span>今日へ移動</span></Link>
    </div>
  </section>;
}

function GuideCard({ icon, title, text }: { icon: JSX.Element; title: string; text: string }): JSX.Element {
  return <article className={styles.step}><span className={styles.stepIcon}>{icon}</span><div><h3>{title}</h3><p>{text}</p></div></article>;
}

type ProviderInput = Provider | 'auto';

function providerLabel(provider: Provider): string {
  return { rss: 'RSS / Atom', json_api: 'JSON API', github_releases: 'GitHub Releases', html: 'Webページ', tavily: 'Tavily検索' }[provider];
}

function guessProvider(endpoint: string): Provider {
  try {
    const url = new URL(endpoint);
    const path = url.pathname.toLowerCase();
    if (url.hostname === 'api.github.com' && path.includes('/releases')) return 'github_releases';
    if (path.endsWith('.json') || path.includes('/api/')) return 'json_api';
    if (path.endsWith('.xml') || path.includes('rss') || path.includes('feed') || path.includes('atom')) return 'rss';
  } catch {
    return 'html';
  }
  return 'html';
}

function splitList(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

function joinList(value: string[] | undefined): string { return value?.join(', ') ?? ''; }

function addDays(dayKey: string, days: number): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
