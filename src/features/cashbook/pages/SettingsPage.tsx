import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSnackbar } from '../components/useSnackbar';
import { useCashbookApi } from '../lib/useCashbookApi';
import { errorMessage } from '../lib/error';
import { formatCurrency } from '../lib/format';
import type { Category, CategoryCreateResponse, Merchant, TransactionKind } from '../lib/types';

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <BalanceSettings />
      <CategorySettings />
      <MerchantSettings />
    </div>
  );
}

function BalanceSettings() {
  const queryClient = useQueryClient();
  const { notify } = useSnackbar();
  const api = useCashbookApi();
  const [open, setOpen] = useState(true);
  const [currentBalance, setCurrentBalance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: api.settings,
  });
  const updateSettings = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      setCurrentBalance(String(data.currentBalance));
      setError(null);
      notify('success', '現在の残高を保存しました。');
    },
    onError: (caught) => {
      const message = errorMessage(caught, '現在の残高の保存に失敗しました。');
      setError(message);
      notify('error', message);
    },
  });
  const resetSettings = useMutation({
    mutationFn: api.resetSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['settings'], data);
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      setCurrentBalance(String(data.currentBalance));
      setError(null);
      notify('success', '残高補正を解除しました。');
    },
    onError: (caught) => {
      const message = errorMessage(caught, '残高補正の解除に失敗しました。');
      setError(message);
      notify('error', message);
    },
  });

  const savedCurrentBalance = settings.data?.currentBalance ?? 0;
  const displayValue = settings.isLoading ? '...' : formatCurrency(savedCurrentBalance);

  useEffect(() => {
    if (settings.data) setCurrentBalance(String(settings.data.currentBalance));
  }, [settings.data]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (currentBalance.trim() === '') {
      setError('現在の残高を入力してください');
      return;
    }
    const parsedCurrentBalance = Number(currentBalance);
    if (!Number.isInteger(parsedCurrentBalance)) {
      setError('現在の残高は整数で入力してください');
      return;
    }
    updateSettings.mutate({ currentBalance: parsedCurrentBalance });
  }

  function handleReset() {
    if (confirm('残高補正を解除して、取引記録から計算した残高に戻しますか？')) {
      resetSettings.mutate();
    }
  }

  return (
    <AccordionSection title="現在の残高" open={open} onOpenChange={setOpen}>
      <form className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block">
            <span className="text-sm font-medium">現在の残高</span>
            <input
              className="mt-1 touch-button w-full rounded-md border border-slate-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
              type="number"
              inputMode="numeric"
              step="1"
              value={currentBalance}
              onChange={(event) => setCurrentBalance(event.target.value)}
              onFocus={() => {
                if (currentBalance === '') setCurrentBalance(String(savedCurrentBalance));
              }}
              placeholder={String(savedCurrentBalance)}
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="touch-button rounded-md bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              className="touch-button rounded-md border border-slate-300 px-4 text-sm font-semibold disabled:opacity-60 dark:border-zinc-700"
              disabled={resetSettings.isPending}
              onClick={handleReset}
            >
              補正解除
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">現在の表示残高: {displayValue}</p>
        {error ? <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
      </form>
    </AccordionSection>
  );
}

function CategorySettings() {
  const queryClient = useQueryClient();
  const { notify } = useSnackbar();
  const api = useCashbookApi();
  const [open, setOpen] = useState(true);
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [parentName, setParentName] = useState('');
  const [childName, setChildName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const categories = useQuery({ queryKey: ['categories'], queryFn: api.categories });
  const createCategory = useMutation({
    mutationFn: api.createCategory,
    onSuccess: (data: CategoryCreateResponse) => {
      queryClient.setQueryData(['categories'], { categories: data.categories });
      setChildName('');
      setError(null);
      notify('success', 'カテゴリを追加しました。');
    },
    onError: (caught) => {
      const message = errorMessage(caught, 'カテゴリの追加に失敗しました。');
      setError(message);
      notify('error', message);
    },
  });
  const updateCategory = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateCategory(id, { name }),
    onSuccess: (data: { categories: Category[] }) => {
      queryClient.setQueryData(['categories'], { categories: data.categories });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setEditingCategoryId(null);
      setEditingCategoryName('');
      setError(null);
      notify('success', 'カテゴリを更新しました。');
    },
    onError: (caught) => {
      const message = errorMessage(caught, 'カテゴリの更新に失敗しました。');
      setError(message);
      notify('error', message);
    },
  });
  const deleteCategory = useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: (data: { categories: Category[] }) => {
      queryClient.setQueryData(['categories'], { categories: data.categories });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setError(null);
      notify('success', 'カテゴリを削除しました。');
    },
    onError: (caught) => {
      const message = errorMessage(caught, 'カテゴリの削除に失敗しました。');
      setError(message);
      notify('error', message);
    },
  });

  const grouped = useMemo(() => {
    const items = categories.data?.categories || [];
    return items
      .filter((category) => category.kind === kind && category.parentId === null)
      .map((parent) => ({
        parent,
        children: items.filter((category) => category.parentId === parent.id),
      }));
  }, [categories.data?.categories, kind]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    createCategory.mutate({ kind, parentName, childName });
  }

  function handleCategoryEdit(category: Category) {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setError(null);
  }

  function handleCategoryUpdate() {
    if (!editingCategoryId) return;
    updateCategory.mutate({ id: editingCategoryId, name: editingCategoryName });
  }

  function handleCategoryDelete(category: Category) {
    if (confirm(`カテゴリ「${category.name}」を削除しますか？`)) {
      deleteCategory.mutate(category.id);
    }
  }

  return (
    <AccordionSection title="カテゴリ管理" open={open} onOpenChange={setOpen}>
      <div className="flex justify-end">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1 dark:bg-zinc-900">
          {(['expense', 'income'] as TransactionKind[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`touch-button rounded-md px-3 text-sm font-medium ${
                kind === value
                  ? value === 'income'
                    ? 'bg-blue-600 text-white'
                    : 'bg-red-600 text-white'
                  : value === 'income'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200'
                    : 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-200'
              }`}
              onClick={() => setKind(value)}
            >
              {value === 'income' ? '収入' : '支出'}
            </button>
          ))}
        </div>
      </div>

      <form className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900" onSubmit={handleSubmit}>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="text-sm font-medium">大カテゴリ</span>
            <input
              className="mt-1 touch-button w-full rounded-md border border-slate-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
              value={parentName}
              onChange={(event) => setParentName(event.target.value)}
              placeholder={kind === 'income' ? '収入' : '食費'}
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">小カテゴリ</span>
            <input
              className="mt-1 touch-button w-full rounded-md border border-slate-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
              value={childName}
              onChange={(event) => setChildName(event.target.value)}
              placeholder={kind === 'income' ? '給与' : '外食'}
              required
            />
          </label>
          <button
            type="submit"
            className="touch-button self-end rounded-md bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
            disabled={createCategory.isPending}
          >
            {createCategory.isPending ? '追加中...' : '追加'}
          </button>
        </div>
        {error ? <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
      </form>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {categories.isLoading ? (
          <div className="p-4 text-sm text-slate-500 dark:text-zinc-400">読み込み中...</div>
        ) : grouped.length === 0 ? (
          <div className="p-4 text-sm text-slate-500 dark:text-zinc-400">カテゴリはまだありません。</div>
        ) : (
          grouped.map(({ parent, children }) => (
            <div key={parent.id} className="border-b border-slate-100 last:border-b-0 dark:border-zinc-800">
              <ManageRow
                label={parent.name}
                meta="大カテゴリ"
                editing={editingCategoryId === parent.id}
                editingValue={editingCategoryName}
                onEditingValueChange={setEditingCategoryName}
                onEdit={() => handleCategoryEdit(parent)}
                onCancel={() => setEditingCategoryId(null)}
                onSave={handleCategoryUpdate}
                onDelete={() => handleCategoryDelete(parent)}
                saving={updateCategory.isPending}
                deleting={deleteCategory.isPending}
              />
              <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                {children.map((child) => (
                  <ManageRow
                    key={child.id}
                    label={child.name}
                    meta="小カテゴリ"
                    indent
                    editing={editingCategoryId === child.id}
                    editingValue={editingCategoryName}
                    onEditingValueChange={setEditingCategoryName}
                    onEdit={() => handleCategoryEdit(child)}
                    onCancel={() => setEditingCategoryId(null)}
                    onSave={handleCategoryUpdate}
                    onDelete={() => handleCategoryDelete(child)}
                    saving={updateCategory.isPending}
                    deleting={deleteCategory.isPending}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </AccordionSection>
  );
}

function MerchantSettings() {
  const queryClient = useQueryClient();
  const { notify } = useSnackbar();
  const api = useCashbookApi();
  const [open, setOpen] = useState(true);
  const [name, setName] = useState('');
  const [editingMerchantId, setEditingMerchantId] = useState<string | null>(null);
  const [editingMerchantName, setEditingMerchantName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const merchants = useQuery({ queryKey: ['merchants'], queryFn: api.merchants });
  const createMerchant = useMutation({
    mutationFn: api.createMerchant,
    onSuccess: (data: { merchant: Merchant; merchants: Merchant[] }) => {
      queryClient.setQueryData(['merchants'], { merchants: data.merchants });
      setName('');
      setError(null);
      notify('success', '取引先を追加しました。');
    },
    onError: (caught) => {
      const message = errorMessage(caught, '取引先の追加に失敗しました。');
      setError(message);
      notify('error', message);
    },
  });
  const updateMerchant = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateMerchant(id, { name }),
    onSuccess: (data: { merchants: Merchant[] }) => {
      queryClient.setQueryData(['merchants'], { merchants: data.merchants });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setEditingMerchantId(null);
      setEditingMerchantName('');
      setError(null);
      notify('success', '取引先を更新しました。');
    },
    onError: (caught) => {
      const message = errorMessage(caught, '取引先の更新に失敗しました。');
      setError(message);
      notify('error', message);
    },
  });
  const deleteMerchant = useMutation({
    mutationFn: api.deleteMerchant,
    onSuccess: (data: { merchants: Merchant[] }) => {
      queryClient.setQueryData(['merchants'], { merchants: data.merchants });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setError(null);
      notify('success', '取引先を削除しました。');
    },
    onError: (caught) => {
      const message = errorMessage(caught, '取引先の削除に失敗しました。');
      setError(message);
      notify('error', message);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    createMerchant.mutate({ name });
  }

  function handleMerchantEdit(merchant: Merchant) {
    setEditingMerchantId(merchant.id);
    setEditingMerchantName(merchant.name);
    setError(null);
  }

  function handleMerchantUpdate() {
    if (!editingMerchantId) return;
    updateMerchant.mutate({ id: editingMerchantId, name: editingMerchantName });
  }

  function handleMerchantDelete(merchant: Merchant) {
    if (confirm(`取引先「${merchant.name}」を削除しますか？`)) {
      deleteMerchant.mutate(merchant.id);
    }
  }

  return (
    <AccordionSection title="取引先管理" open={open} onOpenChange={setOpen}>
      <form className="rounded-md border border-slate-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900" onSubmit={handleSubmit}>
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-sm font-medium">取引先</span>
            <input
              className="mt-1 touch-button w-full rounded-md border border-slate-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例: コンビニ、スーパー、店名"
              required
            />
          </label>
          <button
            type="submit"
            className="touch-button self-end rounded-md bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950"
            disabled={createMerchant.isPending}
          >
            {createMerchant.isPending ? '追加中...' : '追加'}
          </button>
        </div>
        {error ? <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
      </form>

      <section className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {merchants.isLoading ? (
          <div className="p-4 text-sm text-slate-500 dark:text-zinc-400">読み込み中...</div>
        ) : (merchants.data?.merchants || []).length === 0 ? (
          <div className="p-4 text-sm text-slate-500 dark:text-zinc-400">取引先はまだありません。</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {(merchants.data?.merchants || []).map((merchant) => (
              <ManageRow
                key={merchant.id}
                label={merchant.name}
                meta="取引先"
                editing={editingMerchantId === merchant.id}
                editingValue={editingMerchantName}
                onEditingValueChange={setEditingMerchantName}
                onEdit={() => handleMerchantEdit(merchant)}
                onCancel={() => setEditingMerchantId(null)}
                onSave={handleMerchantUpdate}
                onDelete={() => handleMerchantDelete(merchant)}
                saving={updateMerchant.isPending}
                deleting={deleteMerchant.isPending}
              />
            ))}
          </div>
        )}
      </section>
    </AccordionSection>
  );
}

interface AccordionSectionProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

function AccordionSection({ title, open, onOpenChange, children }: AccordionSectionProps) {
  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <span className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 dark:border-zinc-700 dark:text-zinc-300">
          {open ? '閉じる' : '開く'}
        </span>
      </button>
      {open ? <div className="space-y-3 border-t border-slate-100 p-3 dark:border-zinc-800">{children}</div> : null}
    </section>
  );
}

interface ManageRowProps {
  label: string;
  meta: string;
  editing: boolean;
  editingValue: string;
  onEditingValueChange: (value: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
  indent?: boolean;
}

function ManageRow({
  label,
  meta,
  editing,
  editingValue,
  onEditingValueChange,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  saving,
  deleting,
  indent,
}: ManageRowProps) {
  if (editing) {
    return (
      <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3 ${indent ? 'pl-5 md:pl-8' : ''}`}>
        <label className="block min-w-0">
          <span className="text-xs text-slate-500 dark:text-zinc-400">{meta}</span>
          <input
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={editingValue}
            onChange={(event) => onEditingValueChange(event.target.value)}
          />
        </label>
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            className="touch-button rounded-md bg-slate-900 px-2 text-sm font-semibold text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 sm:px-3"
            disabled={saving}
            onClick={onSave}
          >
            保存
          </button>
          <button
            type="button"
            className="touch-button rounded-md border border-slate-300 px-2 text-sm dark:border-zinc-700 sm:px-3"
            onClick={onCancel}
          >
            戻す
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-3 ${indent ? 'bg-slate-50/70 pl-5 md:pl-8 dark:bg-zinc-950/40' : ''}`}>
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900 dark:text-zinc-100">{label}</p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">{meta}</p>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        <button type="button" className="touch-button rounded-md border border-slate-300 px-2 text-sm dark:border-zinc-700 sm:px-3" onClick={onEdit}>
          編集
        </button>
        <button
          type="button"
          className="touch-button rounded-md border border-red-300 px-2 text-sm text-red-700 disabled:opacity-50 dark:border-red-800 dark:text-red-300 sm:px-3"
          disabled={deleting}
          onClick={onDelete}
        >
          削除
        </button>
      </div>
    </div>
  );
}
