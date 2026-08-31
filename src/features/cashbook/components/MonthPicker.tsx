interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  showAll?: boolean;
  onShowAllChange?: (value: boolean) => void;
}

export function MonthPicker({ value, onChange, showAll, onShowAllChange }: MonthPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm font-medium text-slate-600 dark:text-zinc-300" htmlFor="month">
        月
      </label>
      <input
        id="month"
        className="touch-button rounded-md border border-slate-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
        type="month"
        value={value}
        disabled={showAll}
        onChange={(event) => onChange(event.target.value)}
      />
      {onShowAllChange ? (
        <label className="inline-flex touch-button items-center gap-2 rounded-md border border-slate-300 px-3 text-sm dark:border-zinc-700">
          <input type="checkbox" checked={showAll} onChange={(event) => onShowAllChange(event.target.checked)} />
          全期間
        </label>
      ) : null}
    </div>
  );
}

