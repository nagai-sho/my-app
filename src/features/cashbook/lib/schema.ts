import { z } from 'zod';

export const transactionSchema = z.object({
  occurredAt: z.string().min(1, '入力日を入力してください'),
  amount: z.number().int('金額は整数で入力してください').positive('金額は1円以上で入力してください'),
  kind: z.enum(['income', 'expense']),
  categoryId: z.string().min(1, 'カテゴリを選択してください'),
  merchantName: z.string(),
  isCreditCard: z.boolean(),
  memo: z.string(),
});

