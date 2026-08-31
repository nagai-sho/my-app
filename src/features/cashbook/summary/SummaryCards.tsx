import type { MonthlySummary } from '../lib/types';
import { formatCurrency } from '../lib/format';

interface SummaryCardsProps {
  summary?: MonthlySummary;
  loading?: boolean;
}

export function SummaryCards({ summary, loading }: SummaryCardsProps) {
  const values = [
    { label: '収入', value: summary?.income ?? 0, className: 'text-income' },
    { label: '支出', value: summary?.expense ?? 0, className: 'text-expense' },
    { label: '差額', value: summary?.net ?? 0, className: (summary?.net ?? 0) >= 0 ? 'text-income' : 'text-expense' },
    { label: '残高', value: summary?.balance ?? 0, className: 'text-slate-950 dark:text-zinc-50' },
    ...(summary?.foodDailyAverage === undefined
      ? []
      : [{ label: '食費/日', value: summary.foodDailyAverage, className: 'text-expense' }]),
    ...(summary?.foodMonthlyForecast === undefined
      ? []
      : [{ label: '食費/月', value: summary.foodMonthlyForecast, className: 'text-expense' }]),
  ];

  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
      {values.map((item) => (
        <article
          key={item.label}
          className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="text-xs text-slate-500 dark:text-zinc-400">{item.label}</p>
          <p className={`mt-1 text-xl font-semibold ${item.className}`}>
            {loading ? '...' : formatCurrency(item.value)}
          </p>
        </article>
      ))}
    </section>
  );
}
