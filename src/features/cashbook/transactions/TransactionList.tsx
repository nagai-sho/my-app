import type { Transaction } from '../lib/types';
import { formatCurrency, formatTransactionDateTime } from '../lib/format';

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  loading?: boolean;
}

export function TransactionList({ transactions, onEdit, onDelete, loading }: TransactionListProps) {
  if (loading) {
    return <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">読み込み中...</div>;
  }

  if (transactions.length === 0) {
    return <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">取引はまだありません。</div>;
  }

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {transactions.map((transaction) => (
        <article
          key={transaction.id}
          className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 p-3 last:border-b-0 dark:border-zinc-800"
        >
          <button type="button" className="min-w-0 text-left" onClick={() => onEdit(transaction)}>
            <div className="flex items-center justify-between gap-3">
              <p
                className={`text-lg font-semibold ${
                  transaction.kind === 'income' ? 'text-income' : 'text-expense'
                }`}
              >
                {transaction.kind === 'income' ? '+' : '-'}
                {formatCurrency(transaction.amount)}
              </p>
              <p className="shrink-0 text-xs text-slate-500 dark:text-zinc-400">{formatTransactionDateTime(transaction.occurredAt)}</p>
            </div>
            <p className="mt-1 truncate text-sm text-slate-700 dark:text-zinc-300">
              {[transaction.parentCategoryName, transaction.categoryName].filter(Boolean).join(' > ')}
              {transaction.isCreditCard ? <span className="ml-2 text-xs text-slate-500 dark:text-zinc-400">クレカ</span> : null}
            </p>
            {transaction.merchantName ? (
              <p className="mt-1 truncate text-sm text-slate-500 dark:text-zinc-400">{transaction.merchantName}</p>
            ) : null}
            {transaction.memo ? <p className="mt-1 truncate text-sm text-slate-500 dark:text-zinc-400">{transaction.memo}</p> : null}
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="touch-button rounded-md border border-slate-300 px-3 text-sm hover:bg-slate-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              onClick={() => onEdit(transaction)}
            >
              編集
            </button>
            <button
              type="button"
              className="touch-button rounded-md border border-red-300 px-3 text-sm text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
              onClick={() => onDelete(transaction)}
            >
              削除
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
