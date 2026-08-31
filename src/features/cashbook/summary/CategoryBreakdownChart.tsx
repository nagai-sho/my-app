import { Chart } from 'react-chartjs-2';
import type { Plugin } from 'chart.js';
import type { CategoryBreakdownSummary } from '../lib/types';
import { formatCurrency } from '../lib/format';

interface CategoryBreakdownChartProps {
  categoryBreakdown: CategoryBreakdownSummary[];
}

const palette = [
  '#dc2626',
  '#16a34a',
  '#ca8a04',
  '#9333ea',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
  '#65a30d',
  '#be123c',
];
const salaryColor = '#2563eb';
const incomeBorderColor = '#1d4ed8';

export function CategoryBreakdownChart({ categoryBreakdown }: CategoryBreakdownChartProps) {
  const items = sortBreakdown(groupByParentCategory(categoryBreakdown));
  const colors = items.map((item, index) => (isSalary(item) ? salaryColor : palette[index % palette.length]));
  const incomeCount = items.filter((item) => item.kind === 'income').length;
  const labels = items.map((item) => `${item.kind === 'income' ? '収入' : '支出'}: ${item.categoryName}`);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-semibold">カテゴリ別内訳</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">この月の収入・支出はありません。</p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)]">
          <div className="h-72">
            <Chart
              type="pie"
              data={{
                labels,
                datasets: [
                  {
                    label: '収支',
                    data: items.map((item) => item.amount),
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 1,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom' },
                  tooltip: {
                    callbacks: {
                      label: (context) => `${context.label}: ${formatCurrency(Number(context.raw || 0))}`,
                    },
                  },
                },
              }}
              plugins={[createIncomeGroupBorderPlugin(incomeCount)]}
            />
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={item.categoryId} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 dark:bg-zinc-900">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: colors[index],
                      }}
                    />
                    <p className="truncate text-sm font-medium">{labels[index]}</p>
                  </div>
                </div>
                <p className={`shrink-0 text-sm font-semibold ${item.kind === 'income' ? 'text-income' : 'text-expense'}`}>
                  {formatCurrency(item.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function sortBreakdown(items: CategoryBreakdownSummary[]): CategoryBreakdownSummary[] {
  return [...items].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'income' ? -1 : 1;
    return right.amount - left.amount;
  });
}

function groupByParentCategory(items: CategoryBreakdownSummary[]): CategoryBreakdownSummary[] {
  const grouped = new Map<string, CategoryBreakdownSummary>();

  for (const item of items) {
    const categoryName = item.parentCategoryName || item.categoryName;
    const categoryId = item.parentCategoryName ? `${item.kind}:${categoryName}` : item.categoryId;
    const key = `${item.kind}:${categoryId}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.amount += item.amount;
    } else {
      grouped.set(key, {
        ...item,
        categoryId,
        categoryName,
        parentCategoryName: null,
      });
    }
  }

  return [...grouped.values()];
}

function isSalary(item: CategoryBreakdownSummary): boolean {
  return item.kind === 'income' && item.categoryName === '給与';
}

function createIncomeGroupBorderPlugin(incomeCount: number): Plugin<'pie'> {
  return {
    id: `income-group-border-${incomeCount}`,
    afterDatasetsDraw: (chart) => {
      if (incomeCount === 0) return;

      const meta = chart.getDatasetMeta(0);
      const firstArc = meta.data[0] as unknown as PieArcElement | undefined;
      const lastArc = meta.data[incomeCount - 1] as unknown as PieArcElement | undefined;
      if (!firstArc || !lastArc) return;

      const radius = firstArc.outerRadius - 4;
      const startAngle = firstArc.startAngle;
      const endAngle = lastArc.endAngle;
      const isFullCircle = Math.abs(endAngle - startAngle) >= Math.PI * 2 - 0.01;
      const startX = firstArc.x + Math.cos(startAngle) * radius;
      const startY = firstArc.y + Math.sin(startAngle) * radius;

      const { ctx } = chart;
      ctx.save();
      ctx.beginPath();
      if (isFullCircle) {
        ctx.arc(firstArc.x, firstArc.y, radius, 0, Math.PI * 2);
      } else {
        ctx.moveTo(firstArc.x, firstArc.y);
        ctx.lineTo(startX, startY);
        ctx.arc(firstArc.x, firstArc.y, radius, startAngle, endAngle);
        ctx.closePath();
      }
      ctx.strokeStyle = incomeBorderColor;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    },
  };
}

interface PieArcElement {
  x: number;
  y: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
}
