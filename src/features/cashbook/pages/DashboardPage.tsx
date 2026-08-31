import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { MonthPicker } from '../components/MonthPicker';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SummaryCards } from '../summary/SummaryCards';
import { SummaryChart } from '../summary/SummaryChart';
import { CategoryBreakdownChart } from '../summary/CategoryBreakdownChart';
import { TransactionList } from '../transactions/TransactionList';
import { TransactionModal } from '../transactions/TransactionModal';
import { GmailStarredPanel } from '../gmail/GmailStarredPanel';
import { useCashbookApi } from '../lib/useCashbookApi';
import { useSnackbar } from '../components/useSnackbar';
import { currentMonth, formatDate } from '../lib/format';
import { errorMessage } from '../lib/error';
import type { GmailMessageCandidate, Transaction, TransactionInput } from '../lib/types';

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { notify } = useSnackbar();
  const api = useCashbookApi();
  const [month, setMonth] = useState(currentMonth());
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [draft, setDraft] = useState<Partial<TransactionInput> | null>(null);
  const [gmailCandidate, setGmailCandidate] = useState<GmailMessageCandidate | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const scope = showAll ? 'all' : 'month';
  const transactionOffset = (page - 1) * pageSize;

  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const merchants = useQuery({ queryKey: ['merchants'], queryFn: api.merchants });
  const summary = useQuery({ queryKey: ['summary', { month, scope }], queryFn: () => api.summary({ month, months: 12, scope }) });
  const transactions = useQuery({
    queryKey: ['transactions', { month, scope, limit: pageSize, offset: transactionOffset }],
    queryFn: () => api.transactions({ month, scope, limit: pageSize, offset: transactionOffset }),
  });
  const transactionTotal = transactions.data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(transactionTotal / pageSize));

  useEffect(() => {
    setPage(1);
  }, [month, scope, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const save = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: TransactionInput }): Promise<unknown> =>
      id ? api.updateTransaction(id, input) : api.createTransaction(input),
    onSuccess: (_, variables) => {
      invalidate(queryClient);
      notify('success', variables.id ? '取引を更新しました。' : '取引を登録しました。');
    },
    onError: (caught) => {
      notify('error', errorMessage(caught, '取引の保存に失敗しました。'));
    },
  });
  const remove = useMutation({
    mutationFn: api.deleteTransaction,
    onSuccess: () => {
      invalidate(queryClient);
      notify('success', '取引を削除しました。');
    },
    onError: (caught) => {
      notify('error', errorMessage(caught, '取引の削除に失敗しました。'));
    },
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <MonthPicker value={month} onChange={setMonth} showAll={showAll} onShowAllChange={setShowAll} />
      </div>

      <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs text-slate-500 dark:text-zinc-400">最終入力日</p>
        <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-zinc-50">
          {summary.isLoading ? '...' : summary.data?.lastInputAt ? formatDate(summary.data.lastInputAt) : '未入力'}
        </p>
      </section>

      <SummaryCards summary={summary.data?.current} loading={summary.isLoading} />
      <ErrorBoundary
        fallback={
          <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            グラフを表示できませんでした。サマリーと取引一覧は利用できます。
          </div>
        }
      >
        <SummaryChart monthly={summary.data?.monthly || []} period={showAll ? 'monthly' : 'daily'} />
      </ErrorBoundary>
      <ErrorBoundary
        fallback={
          <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            カテゴリ別支出を表示できませんでした。
          </div>
        }
      >
        <CategoryBreakdownChart categoryBreakdown={summary.data?.categoryBreakdown || []} />
      </ErrorBoundary>

      <GmailStarredPanel
        month={month}
        onUseCandidate={(candidate) => {
          setEditing(null);
          setGmailCandidate(candidate);
          setDraft(candidateToDraft(candidate));
          setModalOpen(true);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{showAll ? '全期間の取引' : '月内取引'}</h2>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
          <span>表示件数</span>
          <select
            className="touch-button rounded-md border border-slate-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-900"
            value={pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
          >
            {[10, 20, 50, 100].map((value) => (
              <option key={value} value={value}>
                {value}件
              </option>
            ))}
          </select>
        </label>
      </div>
      <TransactionList
        transactions={transactions.data?.transactions || []}
        loading={transactions.isLoading}
        onEdit={(transaction) => {
          setEditing(transaction);
          setGmailCandidate(null);
          setDraft(null);
          setModalOpen(true);
        }}
        onDelete={(transaction) => {
          if (confirm('この取引を削除しますか？')) remove.mutate(transaction.id);
        }}
      />
      {transactionTotal > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-slate-600 dark:text-zinc-300">
            {transactionTotal}件中 {transactionOffset + 1}-{Math.min(transactionOffset + pageSize, transactionTotal)}件
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="touch-button rounded-md border border-slate-300 px-3 disabled:opacity-50 dark:border-zinc-700"
              disabled={page <= 1 || transactions.isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              前へ
            </button>
            <span className="min-w-16 text-center text-slate-600 dark:text-zinc-300">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="touch-button rounded-md border border-slate-300 px-3 disabled:opacity-50 dark:border-zinc-700"
              disabled={page >= totalPages || transactions.isLoading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              次へ
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-3xl leading-none text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-950"
        aria-label="新規登録"
        onClick={() => {
          setEditing(null);
          setGmailCandidate(null);
          setDraft(null);
          setModalOpen(true);
        }}
      >
        +
      </button>

      <TransactionModal
        open={modalOpen}
        transaction={editing}
        draft={draft}
        categories={categories.data?.categories || []}
        merchants={merchants.data?.merchants || []}
        onClose={() => {
          setModalOpen(false);
          setGmailCandidate(null);
          setDraft(null);
        }}
        onSubmit={async (input) => {
          const candidate = gmailCandidate;
          await save.mutateAsync({ id: editing?.id, input });
          if (!editing && candidate) {
            try {
              await api.unstarGmailMessage(candidate.id);
              queryClient.setQueryData<{ messages: GmailMessageCandidate[]; totalEstimate: number } | undefined>(
                ['gmail', 'starred'],
                (current) =>
                  current
                    ? {
                        ...current,
                        messages: current.messages.filter((message) => message.id !== candidate.id),
                        totalEstimate: Math.max(0, current.totalEstimate - 1),
                      }
                    : current,
              );
              notify('success', '取引を登録し、Gmailスターを解除しました。');
            } catch (caught) {
              notify('error', errorMessage(caught, '取引は登録しましたが、Gmailスターの解除に失敗しました。'));
            }
          }
        }}
      />
    </div>
  );
}

function candidateToDraft(candidate: GmailMessageCandidate): Partial<TransactionInput> {
  return {
    occurredAt: candidate.date || new Date().toISOString(),
    amount: candidate.amount || undefined,
    kind: 'expense',
    merchantName: candidate.merchantName || '',
    isCreditCard: false,
    memo: [candidate.subject, candidate.snippet].filter(Boolean).join('\n'),
  };
}

function invalidate(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['summary'] });
  queryClient.invalidateQueries({ queryKey: ['transactions'] });
  queryClient.invalidateQueries({ queryKey: ['merchants'] });
}
