import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useCashbookApi } from '../lib/useCashbookApi';
import { formatCurrency, formatDate, localMonth } from '../lib/format';
import type { GmailMessageCandidate } from '../lib/types';
import { useSnackbar } from '../components/useSnackbar';

interface GmailStarredPanelProps {
  month: string;
  onUseCandidate: (candidate: GmailMessageCandidate) => void;
}

export function GmailStarredPanel({ month, onUseCandidate }: GmailStarredPanelProps) {
  const api = useCashbookApi();
  const { notify } = useSnackbar();
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const starred = useQuery({
    queryKey: ['gmail', 'starred'],
    queryFn: api.gmailStarred,
    enabled: false,
    retry: false,
  });
  const allMessages = useMemo(() => starred.data?.messages || [], [starred.data?.messages]);
  const currentMonthMessages = useMemo(() => allMessages.filter((message) => isInMonth(message.date, month)), [allMessages, month]);
  const hiddenCount = allMessages.length - currentMonthMessages.length;
  const visibleMessages = showAll ? allMessages : currentMonthMessages;

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="min-w-0">
          <span className="block text-base font-semibold">Gmailスター付きメール</span>
          {starred.data ? (
            <span className="mt-1 block text-sm text-slate-500 dark:text-zinc-400">
              {visibleMessages.length}件表示中 / {allMessages.length}件取得済み
            </span>
          ) : null}
        </span>
        <span className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 dark:border-zinc-700 dark:text-zinc-300">
          {open ? '閉じる' : '開く'}
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 p-3 dark:border-zinc-800">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <p className="min-w-0 text-sm text-slate-500 dark:text-zinc-400">スター付きメールから取引候補を取得します。</p>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <a
                className="touch-button rounded-md border border-slate-300 px-3 text-sm dark:border-zinc-700"
                href={api.gmailConnectUrl}
                onClick={(event) => {
                  if (!api.idToken) return;
                  event.preventDefault();
                  void api.startGmailConnect()
                    .then((url) => {
                      window.location.assign(url);
                    })
                    .catch((caught: unknown) => {
                      notify('error', caught instanceof Error ? caught.message : 'Gmail連携を開始できませんでした。');
                    });
                }}
              >
                Gmail連携
              </a>
              {starred.data && hiddenCount > 0 && !showAll ? (
                <button
                  type="button"
                  className="touch-button rounded-md border border-slate-300 px-3 text-sm dark:border-zinc-700"
                  onClick={() => setShowAll(true)}
                >
                  全て確認する
                </button>
              ) : null}
              <button
                type="button"
                className="touch-button rounded-md bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
                disabled={starred.isFetching}
                onClick={() => {
                  setShowAll(false);
                  starred.refetch();
                }}
              >
                {starred.isFetching ? '取得中...' : '取得'}
              </button>
            </div>
          </div>

          {starred.error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
              {starred.error instanceof Error ? starred.error.message : 'Gmailの取得に失敗しました。'}
            </p>
          ) : null}

          {starred.data ? (
            allMessages.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-zinc-400">スター付きメールはありません。</p>
            ) : visibleMessages.length === 0 ? (
              <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-600 dark:border-zinc-800 dark:text-zinc-300">
                {month} のスター付きメールはありません。
                {hiddenCount > 0 ? (
                  <button type="button" className="ml-2 font-semibold text-slate-950 underline dark:text-zinc-50" onClick={() => setShowAll(true)}>
                    全て確認する
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {visibleMessages.map((message) => (
                  <article key={message.id} className="rounded-md border border-slate-200 p-3 dark:border-zinc-800">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{message.subject || '(件名なし)'}</p>
                        <p className="mt-1 truncate text-xs text-slate-500 dark:text-zinc-400">{message.from || '送信元不明'}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-zinc-300">{message.snippet}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-semibold">{message.amount ? formatCurrency(message.amount) : '金額未検出'}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{message.date ? formatDate(message.date) : '日付不明'}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <a
                        className="touch-button inline-flex items-center justify-center rounded-md border border-slate-300 px-3 text-sm dark:border-zinc-700"
                        href={message.gmailUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Gmailで開く
                      </a>
                      <button
                        type="button"
                        className="touch-button ml-2 inline-flex items-center justify-center rounded-md border border-slate-300 px-3 text-sm dark:border-zinc-700"
                        onClick={() => onUseCandidate(message)}
                      >
                        取引に反映
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function isInMonth(value: string | null, month: string): boolean {
  return Boolean(value && localMonth(value) === month);
}
