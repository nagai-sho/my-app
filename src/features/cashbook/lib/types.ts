export type TransactionKind = 'income' | 'expense';
export type AuthMode = 'google' | 'local-basic';

export interface Category {
  id: string;
  parentId: string | null;
  kind: TransactionKind;
  name: string;
  sortOrder: number;
}

export interface CategoryInput {
  kind: TransactionKind;
  parentName: string;
  childName: string;
}

export interface CategoryCreateResponse {
  parentId: string;
  categoryId: string;
  categories: Category[];
}

export interface Merchant {
  id: string;
  name: string;
}

export interface AppSettings {
  currentBalance: number;
}

export interface Transaction {
  id: string;
  occurredAt: string;
  amount: number;
  kind: TransactionKind;
  categoryId: string;
  memo: string | null;
  merchantId: string | null;
  merchantName: string | null;
  isCreditCard: boolean;
  categoryName: string;
  parentCategoryName: string | null;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface TransactionInput {
  occurredAt: string;
  amount: number;
  kind: TransactionKind;
  categoryId: string;
  merchantName: string;
  isCreditCard: boolean;
  memo: string;
}

export interface GmailMessageCandidate {
  id: string;
  threadId: string;
  messageId: string | null;
  gmailUrl: string;
  subject: string;
  from: string;
  date: string | null;
  snippet: string;
  amount: number | null;
  merchantName: string | null;
}

export interface GmailStarredResponse {
  messages: GmailMessageCandidate[];
  totalEstimate: number;
}

export interface MonthlySummary {
  yearMonth: string;
  income: number;
  expense: number;
  net: number;
  balance: number;
  foodDailyAverage?: number;
  foodMonthlyForecast?: number;
}

export interface CategoryBreakdownSummary {
  categoryId: string;
  categoryName: string;
  parentCategoryName: string | null;
  kind: TransactionKind;
  amount: number;
}

export interface SummaryResponse {
  current: MonthlySummary;
  monthly: MonthlySummary[];
  trendPeriod: 'daily' | 'monthly';
  categoryBreakdown: CategoryBreakdownSummary[];
  lastInputAt: string | null;
}

export interface SessionUser {
  email: string;
  name?: string;
  picture?: string;
}

