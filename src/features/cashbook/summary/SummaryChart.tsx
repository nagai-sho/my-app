import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Tooltip,
} from 'chart.js';
import { useEffect, useState } from 'react';
import { Chart } from 'react-chartjs-2';
import type { MonthlySummary } from '../lib/types';

ChartJS.register(
  BarController,
  LineController,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PieController,
  PointElement,
  Tooltip,
  Legend,
);

interface SummaryChartProps {
  monthly: MonthlySummary[];
  period: 'daily' | 'monthly';
}

export function SummaryChart({ monthly, period }: SummaryChartProps) {
  const [canvasAvailable, setCanvasAvailable] = useState<boolean | null>(null);
  const chartMinWidth = Math.max(640, monthly.length * (period === 'daily' ? 42 : 72));

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      setCanvasAvailable(Boolean(canvas.getContext('2d')));
    } catch {
      setCanvasAvailable(false);
    }
  }, []);

  if (canvasAvailable === false) {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        グラフを表示できませんでした。サマリーと取引一覧は利用できます。
      </section>
    );
  }

  if (canvasAvailable === null) {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        グラフを読み込み中...
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-base font-semibold">{period === 'daily' ? '日次推移' : '月次推移'}</h2>
      <div className="mt-3 overflow-x-auto">
        <div className="h-72" style={{ minWidth: chartMinWidth }}>
          <Chart
            type="bar"
            data={{
              labels: monthly.map((item) => formatTrendLabel(item.yearMonth, period)),
              datasets: [
                {
                  type: 'bar',
                  label: '収入',
                  data: monthly.map((item) => item.income),
                  backgroundColor: '#2563eb',
                },
                {
                  type: 'bar',
                  label: '支出',
                  data: monthly.map((item) => -item.expense),
                  backgroundColor: '#dc2626',
                },
                {
                  type: 'line',
                  label: '差額',
                  data: monthly.map((item) => item.net),
                  borderColor: '#16a34a',
                  backgroundColor: '#16a34a',
                  tension: 0.35,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'bottom' },
              },
              scales: {
                x: {
                  ticks: {
                    autoSkip: false,
                    maxRotation: period === 'daily' ? 0 : 45,
                    minRotation: 0,
                  },
                },
                y: {
                  ticks: {
                    callback: (value) => `¥${Math.abs(Number(value)).toLocaleString('ja-JP')}`,
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </section>
  );
}

function formatTrendLabel(value: string, period: SummaryChartProps['period']): string {
  if (period === 'daily') {
    const day = Number(value.slice(8, 10));
    return Number.isFinite(day) && day > 0 ? `${day}日` : value;
  }
  return value;
}
