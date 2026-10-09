import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Clock3, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { tasksApi, type TaskRestrictionDurationUnit, type TaskRestrictionInput } from './apiClient';
import { formatRestrictionDate, getRestrictionReleaseDate } from './restrictionDates';
import styles from './RestrictionsPanel.module.css';

const RESTRICTIONS_QUERY_KEY = ['task-restrictions'];
const durationLabels: Record<TaskRestrictionDurationUnit, string> = {
  days: '日',
  months: 'か月',
  years: '年',
};

export function RestrictionsPanel({ today }: { today: string }): JSX.Element {
  const queryClient = useQueryClient();
  const restrictionsQuery = useQuery({ queryKey: RESTRICTIONS_QUERY_KEY, queryFn: tasksApi.listRestrictions });
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState(today);
  const [durationValue, setDurationValue] = useState('1');
  const [durationUnit, setDurationUnit] = useState<TaskRestrictionDurationUnit>('years');
  const [operationError, setOperationError] = useState<string | null>(null);
  const durationNumber = Number(durationValue);
  const releaseDate = useMemo(() => {
    try {
      return getRestrictionReleaseDate(eventDate, durationNumber, durationUnit);
    } catch {
      return null;
    }
  }, [durationNumber, durationUnit, eventDate]);

  const createMutation = useMutation({
    mutationFn: (input: TaskRestrictionInput) => tasksApi.createRestriction(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: RESTRICTIONS_QUERY_KEY });
      setName('');
      setEventDate(today);
      setDurationValue('1');
      setDurationUnit('years');
      setOperationError(null);
    },
    onError: (error: unknown) => setOperationError(getErrorMessage(error, '制限を保存できませんでした。')),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => tasksApi.removeRestriction(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: RESTRICTIONS_QUERY_KEY });
      setOperationError(null);
    },
    onError: (error: unknown) => setOperationError(getErrorMessage(error, '制限を削除できませんでした。')),
  });

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (createMutation.isPending) return;
    if (!name.trim()) {
      setOperationError('制限名を入力してください。');
      return;
    }
    if (!releaseDate || !Number.isInteger(durationNumber) || durationNumber < 1 || durationNumber > 1000) {
      setOperationError('実施日と1〜1000の制限期間を入力してください。');
      return;
    }
    setOperationError(null);
    createMutation.mutate({ name: name.trim(), eventDate, durationValue: durationNumber, durationUnit });
  }

  function removeRestriction(id: string, restrictionName: string): void {
    if (removeMutation.isPending) return;
    if (window.confirm(`「${restrictionName}」の制限記録を削除しますか？`)) removeMutation.mutate(id);
  }

  const restrictions = restrictionsQuery.data?.restrictions ?? [];
  const queryError = restrictionsQuery.error instanceof Error ? restrictionsQuery.error.message : null;

  return (
    <section className={styles.panel} aria-label="制限記録">
      <div className={styles.panelIntro}>
        <div className={styles.panelIcon}><Clock3 size={20} /></div>
        <div>
          <h2>制限を記録</h2>
          <p>実施日と期間から解除日を計算し、解除日以降にアプリ内でお知らせします。</p>
        </div>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          記録名
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={200} placeholder="例: 忘年会" disabled={createMutation.isPending} />
        </label>
        <label className={styles.field}>
          実施日
          <input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} disabled={createMutation.isPending} />
        </label>
        <fieldset className={styles.durationField}>
          <legend>制限期間</legend>
          <input
            aria-label="制限期間の数"
            type="number"
            min={1}
            max={1000}
            step={1}
            value={durationValue}
            onChange={(event) => setDurationValue(event.target.value)}
            disabled={createMutation.isPending}
          />
          <select aria-label="制限期間の単位" value={durationUnit} onChange={(event) => setDurationUnit(event.target.value as TaskRestrictionDurationUnit)} disabled={createMutation.isPending}>
            {(Object.keys(durationLabels) as TaskRestrictionDurationUnit[]).map((unit) => <option key={unit} value={unit}>{durationLabels[unit]}</option>)}
          </select>
        </fieldset>
        <button className={styles.addButton} type="submit" disabled={createMutation.isPending || !name.trim()}>
          <Plus size={17} />
          {createMutation.isPending ? '保存中…' : '制限を追加'}
        </button>
        {releaseDate && <p className={styles.releasePreview}><CalendarDays size={15} />解除予定日: <strong>{formatRestrictionDate(releaseDate)}</strong></p>}
      </form>

      {operationError && <p className={styles.errorMessage} role="alert">{operationError}</p>}
      {queryError && <p className={styles.errorMessage} role="alert">制限記録を読み込めませんでした。{queryError}</p>}

      <div className={styles.listHeader}>
        <h2>登録した制限</h2>
        {!restrictionsQuery.isLoading && <span>{restrictions.length}件</span>}
      </div>
      {restrictionsQuery.isLoading ? (
        <p className={styles.emptyState}>制限記録を読み込み中…</p>
      ) : restrictions.length === 0 ? (
        <p className={styles.emptyState}>制限記録はありません。</p>
      ) : (
        <ul className={styles.restrictionList}>
          {restrictions.map((restriction) => {
            const released = restriction.releaseDate <= today;
            return (
              <li className={styles.restrictionCard} key={restriction.id}>
                <div className={styles.cardMain}>
                  <div className={released ? styles.releasedBadge : styles.activeBadge}>{released ? '解除済み' : '制限中'}</div>
                  <h3>{restriction.name}</h3>
                  <p>実施日: {formatRestrictionDate(restriction.eventDate)}</p>
                  <p>期間: {restriction.durationValue}{durationLabels[restriction.durationUnit]}</p>
                  <p className={styles.releaseDate}>解除予定日: <strong>{formatRestrictionDate(restriction.releaseDate)}</strong></p>
                </div>
                <button
                  className={styles.deleteButton}
                  type="button"
                  aria-label={`${restriction.name}の制限記録を削除`}
                  title="削除"
                  onClick={() => removeRestriction(restriction.id, restriction.name)}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 size={17} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
