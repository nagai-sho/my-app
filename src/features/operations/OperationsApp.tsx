import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  ExternalLink,
  House,
  LogOut,
  RefreshCw,
  Server,
  Target,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  formatActivityTime,
  formatOperationTime,
  operationsApi,
  type RunStatus,
  type ServiceHealth,
  type ServiceStatus,
} from './apiClient';
import styles from './OperationsApp.module.css';

interface OperationsAppProps {
  onLogout: () => void;
}

const serviceStatusLabels: Record<ServiceStatus, string> = {
  online: '稼働中',
  degraded: '要確認',
  offline: '停止',
  unknown: '未確認',
};

const runStatusLabels: Record<RunStatus, string> = {
  running: '実行中',
  success: '成功',
  partial: '一部成功',
  fail: '失敗',
};

export function OperationsApp({ onLogout }: OperationsAppProps): JSX.Element {
  const operationsQuery = useQuery({
    queryKey: ['operations'],
    queryFn: operationsApi.summary,
    refetchOnWindowFocus: false,
  });
  const data = operationsQuery.data;
  const apps = data?.summary.apps;
  const tasks = data?.summary.tasks;
  const gatherer = data?.summary.gatherer;
  const services = data?.services ?? [];
  const activity = data?.recentActivity ?? [];
  const completionRate = tasks && tasks.total > 0 ? Math.round((tasks.done / tasks.total) * 100) : 0;
  const lastCheckedLabel = useMemo(() => formatOperationTime(data?.checkedAt), [data?.checkedAt]);
  const errorMessage = operationsQuery.error instanceof Error ? operationsQuery.error.message : null;
  const overallStatus = operationsQuery.isLoading ? 'loading' : errorMessage ? 'error' : apps && apps.attention > 0 ? 'attention' : apps && apps.unknown > 0 ? 'unknown' : 'healthy';
  const overallClass = overallStatus === 'attention' ? styles.overallAttention : overallStatus === 'error' ? styles.overallError : overallStatus === 'loading' || overallStatus === 'unknown' ? styles.overallUnknown : styles.overallHealthy;
  const overallLabel = overallStatus === 'attention' ? '要確認の項目があります' : overallStatus === 'error' ? '運用状況を取得できません' : overallStatus === 'loading' ? '状態を確認しています' : overallStatus === 'unknown' ? '監視対象外の項目があります' : '大きな問題はありません';
  const serviceDetail = apps?.attention ? `${apps.attention}件を確認してください` : apps?.unknown ? `${apps.unknown}件は監視対象外` : 'すべて応答あり';
  const serviceTone = apps?.attention || apps?.unknown ? 'orange' : 'green';

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Link className={styles.homeButton} to="/" aria-label="ホームに戻る"><House size={18} /></Link>
            <div>
              <p className={styles.kicker}>SYSTEM OVERVIEW</p>
              <h1>運用状況</h1>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.headerButton} type="button" title="再確認" aria-label="運用状況を再確認" onClick={() => void operationsQuery.refetch()} disabled={operationsQuery.isFetching}>
              <RefreshCw size={18} className={operationsQuery.isFetching ? styles.spinning : undefined} />
            </button>
            <button className={styles.headerButton} type="button" title="ログアウト" aria-label="ログアウト" onClick={onLogout}><LogOut size={18} /></button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>OPERATIONS CENTER</p>
            <h2>アプリと日々の運用を、ひと目で確認。</h2>
            <p>サービスの応答、タスクの進み具合、記事収集の状態をまとめて表示します。</p>
          </div>
          <div className={overallClass}>
            <span className={styles.overallDot} />
            <span>{overallLabel}</span>
          </div>
        </section>

        {errorMessage && <div className={styles.errorBanner} role="alert"><AlertCircle size={18} /><span>{errorMessage}</span><button type="button" onClick={() => void operationsQuery.refetch()}>再読み込み</button></div>}

        {operationsQuery.isLoading && <DashboardSkeleton />}
        {!operationsQuery.isLoading && !errorMessage && data && (
          <>
            <section className={styles.metrics} aria-label="運用サマリー">
              <MetricCard icon={<Server size={18} />} label="サービス" value={`${apps?.online ?? 0}/${apps?.total ?? 0}`} detail={serviceDetail} tone={serviceTone} />
              <MetricCard icon={<Target size={18} />} label="未完了タスク" value={String(tasks?.pending ?? 0)} detail={`今日 ${tasks?.today ?? 0}件 · 超過 ${tasks?.overdue ?? 0}件`} tone={tasks?.overdue ? 'orange' : 'blue'} />
              <MetricCard icon={<Activity size={18} />} label="収集元" value={`${gatherer?.enabledSources ?? 0}/${gatherer?.totalSources ?? 0}`} detail="有効な情報源" tone="purple" />
              <MetricCard icon={<CheckCircle2 size={18} />} label="タスク完了率" value={`${completionRate}%`} detail={`${tasks?.done ?? 0}/${tasks?.total ?? 0}件完了`} tone="green" />
            </section>

            <section className={styles.panel} aria-labelledby="services-title">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>SERVICE HEALTH</p>
                  <h2 id="services-title">サービスの状態</h2>
                </div>
                <span className={styles.checkedAt}>最終確認 {lastCheckedLabel}</span>
              </div>
              <div className={styles.serviceList}>
                {services.map((service) => <ServiceCard key={service.id} service={service} />)}
              </div>
            </section>

            <div className={styles.detailGrid}>
              <section className={styles.detailPanel} aria-labelledby="tasks-summary-title">
                <div className={styles.detailHeader}>
                  <div className={styles.detailIconBlue}><Target size={19} /></div>
                  <div><p className={styles.panelKicker}>TASKS</p><h2 id="tasks-summary-title">タスクの進捗</h2></div>
                  <Link className={styles.panelLink} to="/tasks" aria-label="タスク管理を開く"><ArrowUpRight size={17} /></Link>
                </div>
                <div className={styles.progressSummary}><strong>{tasks?.done ?? 0}</strong><span>/ {tasks?.total ?? 0}件完了</span><b>{completionRate}%</b></div>
                <div className={styles.progressTrack}><span style={{ width: `${completionRate}%` }} /></div>
                <div className={styles.detailStats}><span><i className={styles.blueDot} />未完了 <b>{tasks?.pending ?? 0}</b></span><span><i className={styles.orangeDot} />期限超過 <b>{tasks?.overdue ?? 0}</b></span><span><i className={styles.greenDot} />今日 <b>{tasks?.today ?? 0}</b></span></div>
              </section>

              <section className={styles.detailPanel} aria-labelledby="gatherer-summary-title">
                <div className={styles.detailHeader}>
                  <div className={styles.detailIconPurple}><Activity size={19} /></div>
                  <div><p className={styles.panelKicker}>GATHERER</p><h2 id="gatherer-summary-title">記事収集</h2></div>
                  <Link className={styles.panelLink} to="/gatherer" aria-label="Gathererを開く"><ArrowUpRight size={17} /></Link>
                </div>
                <div className={styles.gathererMain}><div><span className={styles.subtleLabel}>有効な情報源</span><strong>{gatherer?.enabledSources ?? 0}<small> / {gatherer?.totalSources ?? 0}</small></strong></div><div className={styles.runState}><span className={runStateClass(gatherer?.latestRun?.status)} />{gatherer?.latestRun ? runStatusLabels[gatherer.latestRun.status] : '未実行'}</div></div>
                <p className={styles.lastRun}>{gatherer?.latestRun ? `最終実行 ${formatOperationTime(gatherer.latestRun.ranAt)}` : 'まだ収集は実行されていません'}</p>
              </section>
            </div>

            <section className={styles.panel} aria-labelledby="activity-title">
              <div className={styles.panelHeader}>
                <div><p className={styles.panelKicker}>RECENT ACTIVITY</p><h2 id="activity-title">最近の動き</h2></div>
                <Clock3 size={18} className={styles.headerMutedIcon} />
              </div>
              {activity.length === 0 ? <p className={styles.emptyActivity}>最近の活動はありません。</p> : <div className={styles.activityList}>{activity.map((item) => <ActivityRow key={item.id} type={item.type} title={item.title} detail={item.detail} at={item.at} />)}</div>}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, detail, tone }: { icon: JSX.Element; label: string; value: string; detail: string; tone: 'green' | 'blue' | 'purple' | 'orange' }): JSX.Element {
  const toneClass = tone === 'green' ? styles.metricGreen : tone === 'blue' ? styles.metricBlue : tone === 'purple' ? styles.metricPurple : styles.metricOrange;
  return <article className={styles.metricCard}><div className={`${styles.metricIcon} ${toneClass}`}>{icon}</div><div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div></article>;
}

function ServiceCard({ service }: { service: ServiceHealth }): JSX.Element {
  const statusClass = service.status === 'online' ? styles.statusOnline : service.status === 'degraded' ? styles.statusDegraded : service.status === 'offline' ? styles.statusOffline : styles.statusUnknown;
  const isInternal = service.category === 'integrated' && service.url.startsWith('/');
  const body = <><span className={styles.serviceName}>{service.name}</span><span className={styles.serviceDescription}>{service.description || (service.category === 'external' ? service.url : '統合アプリ')}</span></>;
  return <article className={styles.serviceCard}><div className={`${styles.serviceStatusIcon} ${statusClass}`}>{service.status === 'online' ? <CheckCircle2 size={18} /> : service.status === 'offline' ? <XCircle size={18} /> : <AlertCircle size={18} />}</div><div className={styles.serviceMain}>{isInternal ? <Link className={styles.serviceLink} to={service.url}>{body}</Link> : <a className={styles.serviceLink} href={service.url} target="_blank" rel="noreferrer">{body}<ExternalLink size={13} className={styles.externalIcon} /></a>}<div className={styles.serviceMeta}><span className={`${styles.statusBadge} ${statusClass}`}>{serviceStatusLabels[service.status]}</span><span>{service.detail}</span>{service.responseTimeMs !== null && <span>{service.responseTimeMs}ms</span>}</div></div></article>;
}

function ActivityRow({ type, title, detail, at }: { type: 'task' | 'gatherer'; title: string; detail: string; at: number }): JSX.Element {
  return <div className={styles.activityRow}><div className={type === 'task' ? styles.activityTaskIcon : styles.activityGathererIcon}>{type === 'task' ? <CircleDot size={16} /> : <Activity size={16} />}</div><div className={styles.activityBody}><strong>{title}</strong><span>{detail}</span></div><time>{formatActivityTime(at)}</time></div>;
}

function DashboardSkeleton(): JSX.Element {
  return <div className={styles.skeletonStack} aria-label="読み込み中"><div className={styles.skeletonMetrics}>{[1, 2, 3, 4].map((item) => <span key={item} />)}</div><div className={styles.skeletonPanel}><span /><span /><span /><span /><span /><span /></div><div className={styles.skeletonDetails}><span /><span /></div></div>;
}

function runStateClass(status: RunStatus | undefined): string {
  if (status === 'success') return styles.runSuccess;
  if (status === 'partial') return styles.runPartial;
  if (status === 'fail') return styles.runFail;
  return styles.runUnknown;
}
