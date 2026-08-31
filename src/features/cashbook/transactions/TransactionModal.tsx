import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Merchant, Transaction, TransactionInput, TransactionKind } from '../lib/types';
import { fromDateInputValue, toDateInputValue, toDatetimeLocal } from '../lib/format';
import { transactionSchema } from '../lib/schema';

interface TransactionModalProps {
  categories: Category[];
  merchants: Merchant[];
  transaction?: Transaction | null;
  draft?: Partial<TransactionInput> | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (input: TransactionInput) => Promise<void>;
}

const defaultParentByKind: Record<TransactionKind, string> = {
  income: 'income',
  expense: 'expense-food',
};

export function TransactionModal({ categories, merchants, transaction, draft, open, onClose, onSubmit }: TransactionModalProps) {
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amount, setAmount] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
  const [manualOccurredAt, setManualOccurredAt] = useState(false);
  const [autoOccurredAt, setAutoOccurredAt] = useState(new Date().toISOString());
  const [occurredDate, setOccurredDate] = useState(toDateInputValue(new Date().toISOString()));
  const [parentId, setParentId] = useState(defaultParentByKind.expense);
  const [categoryId, setCategoryId] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [isCreditCard, setIsCreditCard] = useState(false);
  const [memo, setMemo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const initializedKey = useRef<string | null>(null);

  const parentCategories = useMemo(
    () => categories.filter((category) => category.kind === kind && category.parentId === null),
    [categories, kind],
  );
  const childCategories = useMemo(
    () => categories.filter((category) => category.kind === kind && category.parentId === parentId),
    [categories, kind, parentId],
  );
  useEffect(() => {
    if (!open) {
      initializedKey.current = null;
      return;
    }

    const key = transaction?.id || (draft ? `draft:${JSON.stringify(draft)}` : 'new');
    if (initializedKey.current === key) return;
    initializedKey.current = key;

    if (transaction) {
      const category = categories.find((item) => item.id === transaction.categoryId);
      const firstParent = categories.find((item) => item.kind === transaction.kind && item.parentId === null);
      setKind(transaction.kind);
      setAmount(String(transaction.amount));
      setManualOccurredAt(isDateOnlyTransaction(transaction.occurredAt));
      setAutoOccurredAt(transaction.occurredAt);
      setOccurredDate(toDateInputValue(transaction.occurredAt));
      setParentId(category?.parentId || firstParent?.id || defaultParentByKind[transaction.kind]);
      setCategoryId(transaction.categoryId);
      setMerchantName(transaction.merchantName || '');
      setIsCreditCard(Boolean(transaction.isCreditCard));
      setMemo(transaction.memo || '');
      setError(null);
      setFieldErrors({});
      return;
    }

    const nextKind = draft?.kind || (localStorage.getItem('cashbook:last-kind') as TransactionKind | null) || 'expense';
    const nextCategory = draft?.categoryId || localStorage.getItem('cashbook:last-category') || '';
    const category = categories.find((item) => item.id === nextCategory && item.kind === nextKind);
    const firstParent = categories.find((item) => item.kind === nextKind && item.parentId === null);
    setKind(nextKind);
    setAmount(draft?.amount ? String(draft.amount) : '');
    setManualOccurredAt(Boolean(draft?.occurredAt));
    const now = draft?.occurredAt || new Date().toISOString();
    setAutoOccurredAt(now);
    setOccurredDate(toDateInputValue(now));
    setParentId(category?.parentId || firstParent?.id || defaultParentByKind[nextKind]);
    setCategoryId(category?.id || '');
    setMerchantName(draft?.merchantName || '');
    setIsCreditCard(Boolean(draft?.isCreditCard));
    setMemo(draft?.memo || '');
    setError(null);
    setFieldErrors({});
  }, [categories, draft, open, transaction]);

  useEffect(() => {
    if (!open) return;
    if (childCategories.length === 0) return;
    const exists = childCategories.some((category) => category.id === categoryId);
    if (!exists) setCategoryId(childCategories[0]?.id || '');
  }, [categoryId, childCategories, open]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const parsedAmount = Number(amount);
    const occurredAt = manualOccurredAt ? fromDateInputValue(occurredDate) : transaction ? autoOccurredAt : new Date().toISOString();
    const parsed = transactionSchema.safeParse({
      occurredAt,
      amount: parsedAmount,
      kind,
      categoryId,
      merchantName,
      isCreditCard,
      memo,
    });

    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0] || 'form'), issue.message]),
        ),
      );
      setError('入力内容を確認してください。');
      return;
    }

    try {
      setSaving(true);
      await onSubmit(parsed.data);
      localStorage.setItem('cashbook:last-kind', kind);
      localStorage.setItem('cashbook:last-category', categoryId);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50">
      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-lg bg-white p-4 shadow-xl dark:bg-zinc-950 md:left-1/2 md:top-1/2 md:bottom-auto md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{transaction ? '取引編集' : '新規取引'}</h2>
          <button
            type="button"
            className="touch-button rounded-md border border-slate-300 px-3 text-sm dark:border-zinc-700"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1 dark:bg-zinc-900">
            {(['expense', 'income'] as TransactionKind[]).map((value) => (
              <button
                key={value}
                type="button"
                className={`touch-button rounded-md text-sm font-medium ${
                  kind === value
                    ? value === 'income'
                      ? 'bg-blue-600 text-white'
                      : 'bg-red-600 text-white'
                    : 'text-slate-600 dark:text-zinc-300'
                }`}
                onClick={() => {
                  setKind(value);
                  const firstParent = categories.find((category) => category.kind === value && category.parentId === null);
                  setParentId(firstParent?.id || defaultParentByKind[value]);
                  setCategoryId('');
                }}
              >
                {value === 'income' ? '収入' : '支出'}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-sm font-medium">金額</span>
            <input
              className="mt-1 touch-button w-full rounded-md border border-slate-300 bg-white px-3 text-right text-2xl font-semibold dark:border-zinc-700 dark:bg-zinc-900"
              type="text"
              inputMode="numeric"
              value={amountFocused ? amount : formatAmountInput(amount)}
              onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
              placeholder="0"
              required
            />
            {fieldErrors.amount ? <FieldError message={fieldErrors.amount} /> : null}
          </label>

          <label className="block">
            <span className="text-sm font-medium">取引先</span>
            <input
              className="mt-1 touch-button w-full rounded-md border border-slate-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
              list="merchant-options"
              value={merchantName}
              onChange={(event) => setMerchantName(event.target.value)}
              placeholder="例: コンビニ、スーパー、店名"
            />
            {fieldErrors.merchantName ? <FieldError message={fieldErrors.merchantName} /> : null}
            <datalist id="merchant-options">
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.name} />
              ))}
            </datalist>
          </label>

          <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3 dark:border-zinc-800">
            <span className="text-sm font-medium">クレジットカード決済</span>
            <input
              className="h-5 w-5 accent-slate-900 dark:accent-zinc-100"
              type="checkbox"
              checked={isCreditCard}
              onChange={(event) => setIsCreditCard(event.target.checked)}
            />
          </label>
          {fieldErrors.isCreditCard ? <FieldError message={fieldErrors.isCreditCard} /> : null}

          <div className="min-w-0 overflow-hidden rounded-md border border-slate-200 p-3 dark:border-zinc-800">
            <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-3">
              <label className="text-sm font-medium" htmlFor="occurred-date">
                入力日
              </label>
              <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600 dark:text-zinc-300">
                <span>手動入力</span>
                <input
                  className="h-5 w-5 accent-slate-900 dark:accent-zinc-100"
                  type="checkbox"
                  checked={manualOccurredAt}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setManualOccurredAt(checked);
                    if (!checked && !transaction) {
                      setAutoOccurredAt(new Date().toISOString());
                    }
                  }}
                />
              </label>
            </div>
            {manualOccurredAt ? (
              <input
                id="occurred-date"
                className="touch-button block max-w-full rounded-md border border-slate-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                type="date"
                value={occurredDate}
                onChange={(event) => setOccurredDate(event.target.value)}
                required
              />
            ) : (
              <input
                id="occurred-date"
                className="touch-button block max-w-full rounded-md border border-slate-300 bg-slate-100 px-3 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500"
                type="datetime-local"
                value={toDatetimeLocal(autoOccurredAt)}
                disabled
                readOnly
              />
            )}
            {fieldErrors.occurredAt ? <FieldError message={fieldErrors.occurredAt} /> : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-sm font-medium">大カテゴリ</span>
              <select
                className="mt-1 touch-button w-full rounded-md border border-slate-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                value={parentId}
                onChange={(event) => {
                  setParentId(event.target.value);
                  setCategoryId('');
                }}
              >
                {parentCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {fieldErrors.categoryId ? <FieldError message={fieldErrors.categoryId} /> : null}
            </label>
            <label className="block">
              <span className="text-sm font-medium">小カテゴリ</span>
              <select
                className="mt-1 touch-button w-full rounded-md border border-slate-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                required
              >
                {childCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium">メモ</span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="任意"
            />
            {fieldErrors.memo ? <FieldError message={fieldErrors.memo} /> : null}
          </label>

          {error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}

          <button
            type="submit"
            className="touch-button w-full rounded-md bg-slate-900 px-4 font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
            disabled={saving}
          >
            {saving ? '保存中...' : transaction ? '更新' : '登録'}
          </button>
        </form>
      </div>
    </div>
  );
}

function isDateOnlyTransaction(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value);
}

function formatAmountInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('ja-JP');
}

function FieldError({ message }: { message: string }) {
  return <p className="mt-1 text-xs text-red-600 dark:text-red-300">{message}</p>;
}
