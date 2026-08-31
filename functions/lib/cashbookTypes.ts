export type CashbookTransactionKind = 'income' | 'expense';

export interface CashbookSessionUser {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface CashbookRequest {
  method: string;
  url: string;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}

export interface CashbookTransactionInput {
  occurredAt?: string;
  amount?: number;
  kind?: CashbookTransactionKind;
  categoryId?: string;
  merchantName?: string;
  isCreditCard?: boolean;
  memo?: string;
}
