import { getGmailAccessToken } from './cashbookGmail';
import type { D1Database } from '@cloudflare/workers-types';
import {
  CashbookApiError as AppError,
  badRequest,
  json,
  methodNotAllowed,
  notFound,
  readJson,
  unauthorized,
} from './cashbookHttp';
import type { AppEnv } from './env';
import type {
  CashbookRequest,
  CashbookSessionUser as SessionUser,
  CashbookTransactionInput as TransactionInput,
  CashbookTransactionKind as TransactionKind,
} from './cashbookTypes';

const CASHBOOK_PREFIX = '/api/v1/cashbook';
const BALANCE_ADJUSTMENT_KEY = 'balance_adjustment';

const presetCategories: Array<[string, string | null, TransactionKind, string, number]> = [
  ['income', null, 'income', '収入', 10],
  ['income-salary', 'income', 'income', '給与', 10],
  ['income-other', 'income', 'income', 'その他', 20],
  ['expense-food', null, 'expense', '食費', 10],
  ['expense-food-eatout', 'expense-food', 'expense', '外食', 10],
  ['expense-food-cooking', 'expense-food', 'expense', '自炊', 20],
  ['expense-food-cafe', 'expense-food', 'expense', 'カフェ', 30],
  ['expense-home', null, 'expense', '住居', 20],
  ['expense-home-rent', 'expense-home', 'expense', '家賃', 10],
  ['expense-home-supplies', 'expense-home', 'expense', '備品', 20],
  ['expense-utilities', null, 'expense', '光熱', 30],
  ['expense-utilities-electric', 'expense-utilities', 'expense', '電気', 10],
  ['expense-utilities-gas', 'expense-utilities', 'expense', 'ガス', 20],
  ['expense-utilities-water', 'expense-utilities', 'expense', '水道', 30],
  ['expense-communication', null, 'expense', '通信', 40],
  ['expense-communication-mobile', 'expense-communication', 'expense', '携帯', 10],
  ['expense-communication-internet', 'expense-communication', 'expense', 'ネット', 20],
  ['expense-transport', null, 'expense', '交通', 50],
  ['expense-transport-train', 'expense-transport', 'expense', '電車', 10],
  ['expense-transport-taxi', 'expense-transport', 'expense', 'タクシー', 20],
  ['expense-social', null, 'expense', '交際', 60],
  ['expense-social-meal', 'expense-social', 'expense', '会食', 10],
  ['expense-social-gift', 'expense-social', 'expense', '贈答', 20],
  ['expense-medical', null, 'expense', '医療', 70],
  ['expense-medical-hospital', 'expense-medical', 'expense', '病院', 10],
  ['expense-education', null, 'expense', '教養', 80],
  ['expense-education-book', 'expense-education', 'expense', '書籍', 10],
  ['expense-daily', null, 'expense', '日用品', 90],
  ['expense-daily-supplies', 'expense-daily', 'expense', '消耗品', 10],
  ['expense-subscription', null, 'expense', 'サブスク', 100],
  ['expense-subscription-app', 'expense-subscription', 'expense', 'アプリ', 10],
  ['expense-tax', null, 'expense', '税金', 110],
  ['expense-tax-local', 'expense-tax', 'expense', '住民税', 10],
  ['expense-other', null, 'expense', 'その他', 120],
  ['expense-other-misc', 'expense-other', 'expense', '雑費', 10],
  ['expense-payment', null, 'expense', '支払い', 130],
  ['expense-payment-credit-card', 'expense-payment', 'expense', 'クレジットカード', 10],
];

interface CategoryInput {
  kind?: TransactionKind;
  parentName?: string;
  childName?: string;
}

interface CategoryRow {
  id: string;
  parentId: string | null;
  kind: TransactionKind;
  name: string;
  sortOrder: number;
}

interface MerchantRow {
  id: string;
  name: string;
}

interface TransactionListRow {
  [key: string]: unknown;
  isCreditCard: boolean | number;
}

interface SummaryRow {
  yearMonth: string;
  income: number;
  expense: number;
  net: number;
  balance: number;
  foodDailyAverage?: number;
  foodMonthlyForecast?: number;
}

interface CategoryBreakdownRow {
  categoryId: string;
  categoryName: string;
  parentCategoryName: string | null;
  kind: TransactionKind;
  amount: number;
}

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  error?: { message?: string };
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: { name: string; value: string }[] };
  error?: { message?: string };
}

interface GmailCandidate {
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

export async function handleCashbookRoute(
  request: CashbookRequest,
  env: AppEnv,
  user: SessionUser | null,
  pathname: string,
): Promise<Response | null> {
  if (!pathname.startsWith(`${CASHBOOK_PREFIX}/`)) return null;
  if (!user) return unauthorized();

  const path = pathname.slice(CASHBOOK_PREFIX.length).replace(/^\/+|\/+$/g, '');
  const parts = path ? path.split('/') : [];
  const resource = parts[0] || '';
  const id = parts.length > 1 ? decodePathPart(parts[1]) : null;

  switch (resource) {
    case 'categories':
      return handleCategories(request, env, user.id, id, parts.length);
    case 'merchants':
      return handleMerchants(request, env, user.id, id, parts.length);
    case 'settings':
      return handleSettings(request, env, user.id);
    case 'summary':
      return handleSummary(request, env, user.id);
    case 'transactions':
      return handleTransactions(request, env, user.id, id, parts.length);
    case 'gmail':
      return handleGmail(request, env, user, parts.slice(1));
    default:
      return null;
  }
}

async function handleCategories(
  request: CashbookRequest,
  env: AppEnv,
  ownerId: string,
  id: string | null,
  partCount: number,
): Promise<Response> {
  if (request.method === 'GET' && partCount === 1) {
    await seedPresetCategoriesIfEmpty(env.DB, ownerId);
    return json({ categories: await listCategories(env.DB, ownerId) });
  }

  if (request.method === 'POST' && partCount === 1) {
    const input = await readJson<CategoryInput>(request);
    if (input?.kind !== 'income' && input?.kind !== 'expense') return badRequest('入出金区分を選択してください');
    const parentName = input?.parentName?.trim();
    const childName = input?.childName?.trim();
    if (!parentName) return badRequest('大カテゴリ名を入力してください');
    if (!childName) return badRequest('小カテゴリ名を入力してください');

    const parent = await findCategory(env.DB, ownerId, input.kind, null, parentName);
    const parentId = parent?.id || crypto.randomUUID();
    if (!parent) {
      await env.DB.prepare(
        `INSERT INTO cashbook_categories (id, owner_id, parent_id, kind, name, sort_order)
         VALUES (?, ?, NULL, ?, ?, ?)`,
      )
        .bind(parentId, ownerId, input.kind, parentName, await nextSortOrder(env.DB, ownerId, input.kind, null))
        .run();
    }

    const child = await findCategory(env.DB, ownerId, input.kind, parentId, childName);
    const childId = child?.id || crypto.randomUUID();
    if (!child) {
      await env.DB.prepare(
        `INSERT INTO cashbook_categories (id, owner_id, parent_id, kind, name, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
        .bind(childId, ownerId, parentId, input.kind, childName, await nextSortOrder(env.DB, ownerId, input.kind, parentId))
        .run();
    }

    return json({
      parentId,
      categoryId: childId,
      categories: await listCategories(env.DB, ownerId),
    });
  }

  if (!id || partCount !== 2) return methodNotAllowed('GET, POST, PUT, DELETE');
  if (request.method === 'PUT') {
    const input = await readJson<{ name?: unknown }>(request);
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (!name) return badRequest('カテゴリ名を入力してください');

    const category = await env.DB.prepare(
      `SELECT id, parent_id AS parentId, kind, name
       FROM cashbook_categories
       WHERE id = ? AND owner_id = ?
       LIMIT 1`,
    )
      .bind(id, ownerId)
      .first<{ id: string; parentId: string | null; kind: TransactionKind; name: string }>();
    if (!category) return badRequest('カテゴリが見つかりません');

    const duplicate = await findCategory(env.DB, ownerId, category.kind, category.parentId, name);
    if (duplicate && duplicate.id !== id) return badRequest('同じカテゴリ名が既にあります');
    await env.DB.prepare(`UPDATE cashbook_categories SET name = ? WHERE id = ? AND owner_id = ?`)
      .bind(name, id, ownerId)
      .run();
    return json({ categories: await listCategories(env.DB, ownerId) });
  }

  if (request.method === 'DELETE') {
    const category = await env.DB.prepare(
      `SELECT id FROM cashbook_categories WHERE id = ? AND owner_id = ? LIMIT 1`,
    )
      .bind(id, ownerId)
      .first<{ id: string }>();
    if (!category) return badRequest('カテゴリが見つかりません');

    const childCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM cashbook_categories WHERE parent_id = ? AND owner_id = ?`,
    )
      .bind(id, ownerId)
      .first<{ count: number }>();
    if ((childCount?.count || 0) > 0) return badRequest('子カテゴリがあるため削除できません');

    const transactionCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM cashbook_transactions WHERE category_id = ? AND owner_id = ?`,
    )
      .bind(id, ownerId)
      .first<{ count: number }>();
    if ((transactionCount?.count || 0) > 0) return badRequest('取引で使用中のカテゴリは削除できません');

    await env.DB.prepare(`DELETE FROM cashbook_categories WHERE id = ? AND owner_id = ?`)
      .bind(id, ownerId)
      .run();
    return json({ categories: await listCategories(env.DB, ownerId) });
  }

  return methodNotAllowed('GET, POST, PUT, DELETE');
}

async function handleMerchants(
  request: CashbookRequest,
  env: AppEnv,
  ownerId: string,
  id: string | null,
  partCount: number,
): Promise<Response> {
  if (request.method === 'GET' && partCount === 1) {
    return json({ merchants: await listMerchants(env.DB, ownerId) });
  }

  if (request.method === 'POST' && partCount === 1) {
    const input = await readJson<{ name?: unknown }>(request);
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (!name) return badRequest('取引先を入力してください');
    const existing = await findMerchant(env.DB, ownerId, name);
    if (existing) return json({ merchant: existing, merchants: await listMerchants(env.DB, ownerId) });

    const merchantId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO cashbook_merchants (id, owner_id, name) VALUES (?, ?, ?)`,
    )
      .bind(merchantId, ownerId, name)
      .run();
    const merchant = (await findMerchant(env.DB, ownerId, name)) || { id: merchantId, name };
    return json({ merchant, merchants: await listMerchants(env.DB, ownerId) }, { status: 201 });
  }

  if (!id || partCount !== 2) return methodNotAllowed('GET, POST, PUT, DELETE');
  if (request.method === 'PUT') {
    const input = await readJson<{ name?: unknown }>(request);
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    if (!name) return badRequest('取引先を入力してください');
    const merchant = await env.DB.prepare(
      `SELECT id FROM cashbook_merchants WHERE id = ? AND owner_id = ? LIMIT 1`,
    )
      .bind(id, ownerId)
      .first<{ id: string }>();
    if (!merchant) return badRequest('取引先が見つかりません');
    const duplicate = await findMerchant(env.DB, ownerId, name);
    if (duplicate && duplicate.id !== id) return badRequest('同じ取引先が既にあります');
    await env.DB.prepare(`UPDATE cashbook_merchants SET name = ? WHERE id = ? AND owner_id = ?`)
      .bind(name, id, ownerId)
      .run();
    return json({ merchants: await listMerchants(env.DB, ownerId) });
  }

  if (request.method === 'DELETE') {
    const merchant = await env.DB.prepare(
      `SELECT id FROM cashbook_merchants WHERE id = ? AND owner_id = ? LIMIT 1`,
    )
      .bind(id, ownerId)
      .first<{ id: string }>();
    if (!merchant) return badRequest('取引先が見つかりません');
    const transactionCount = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM cashbook_transactions WHERE merchant_id = ? AND owner_id = ?`,
    )
      .bind(id, ownerId)
      .first<{ count: number }>();
    if ((transactionCount?.count || 0) > 0) return badRequest('取引で使用中の取引先は削除できません');
    await env.DB.prepare(`DELETE FROM cashbook_merchants WHERE id = ? AND owner_id = ?`)
      .bind(id, ownerId)
      .run();
    return json({ merchants: await listMerchants(env.DB, ownerId) });
  }

  return methodNotAllowed('GET, POST, PUT, DELETE');
}

async function handleTransactions(
  request: CashbookRequest,
  env: AppEnv,
  ownerId: string,
  id: string | null,
  partCount: number,
): Promise<Response> {
  if (request.method === 'GET' && partCount === 1) {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope') || 'month';
    const month = url.searchParams.get('month') || todayInJst().slice(0, 7);
    const limit = clamp(Number(url.searchParams.get('limit') || 20), 1, 100);
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
    const where = scope === 'all'
      ? 'WHERE t.owner_id = ?'
      : `WHERE t.owner_id = ? AND strftime('%Y-%m', datetime(t.occurred_at, '+9 hours')) = ?`;
    const listArgs = scope === 'all' ? [ownerId, limit, offset] : [ownerId, month, limit, offset];
    const countArgs = scope === 'all' ? [ownerId] : [ownerId, month];
    const count = (await env.DB.prepare(`SELECT COUNT(*) AS total FROM cashbook_transactions t ${where}`)
      .bind(...countArgs)
      .first<{ total: number }>()) || { total: 0 };
    const { results } = await env.DB.prepare(
      `SELECT
        t.id,
        t.occurred_at AS occurredAt,
        t.amount,
        t.kind,
        t.category_id AS categoryId,
        t.memo,
        t.merchant_id AS merchantId,
        m.name AS merchantName,
        t.is_credit_card = 1 AS isCreditCard,
        c.name AS categoryName,
        p.name AS parentCategoryName
       FROM cashbook_transactions t
       JOIN cashbook_categories c ON c.id = t.category_id AND c.owner_id = t.owner_id
       LEFT JOIN cashbook_categories p ON p.id = c.parent_id AND p.owner_id = t.owner_id
       LEFT JOIN cashbook_merchants m ON m.id = t.merchant_id AND m.owner_id = t.owner_id
       ${where}
       ORDER BY t.occurred_at DESC, t.created_at DESC
       LIMIT ? OFFSET ?`,
    )
      .bind(...listArgs)
      .all<TransactionListRow>();
    return json({
      transactions: results.map((transaction: TransactionListRow) => ({ ...transaction, isCreditCard: Boolean(transaction.isCreditCard) })),
      total: count.total,
      limit,
      offset,
    });
  }

  if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'DELETE') {
    return methodNotAllowed('GET, POST, PUT, DELETE');
  }

  if (request.method === 'POST' && partCount !== 1) return methodNotAllowed('GET, POST');
  if ((request.method === 'PUT' || request.method === 'DELETE') && (!id || partCount !== 2)) {
    return badRequest('取引を選択してください');
  }

  if (request.method === 'DELETE') {
    const existing = await env.DB.prepare(
      `SELECT id FROM cashbook_transactions WHERE id = ? AND owner_id = ? LIMIT 1`,
    )
      .bind(id, ownerId)
      .first<{ id: string }>();
    if (!existing) return notFound('取引が見つかりません');
    await env.DB.prepare(`DELETE FROM cashbook_transactions WHERE id = ? AND owner_id = ?`)
      .bind(id, ownerId)
      .run();
    return json({ ok: true });
  }

  const input = await readJson<TransactionInput | null>(request);
  const message = validateTransactionInput(input);
  if (message) return badRequest(message);
  if (!input) return badRequest('入力内容を確認してください');
  const category = await env.DB.prepare(
    `SELECT id, kind FROM cashbook_categories WHERE id = ? AND owner_id = ? LIMIT 1`,
  )
    .bind(input.categoryId, ownerId)
    .first<{ id: string; kind: TransactionKind }>();
  if (!category) return badRequest('カテゴリが見つかりません');
  if (category.kind !== input.kind) return badRequest('入出金区分とカテゴリが一致しません');
  const merchantId = await findOrCreateMerchant(env.DB, ownerId, input.merchantName);

  if (request.method === 'POST') {
    const transactionId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO cashbook_transactions
       (id, owner_id, occurred_at, amount, kind, category_id, memo, merchant_id, is_credit_card)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        transactionId,
        ownerId,
        input.occurredAt,
        input.amount,
        input.kind,
        input.categoryId,
        input.memo || null,
        merchantId,
        input.isCreditCard ? 1 : 0,
      )
      .run();
    return json({ id: transactionId }, { status: 201 });
  }

  const existing = await env.DB.prepare(
    `SELECT id FROM cashbook_transactions WHERE id = ? AND owner_id = ? LIMIT 1`,
  )
    .bind(id, ownerId)
    .first<{ id: string }>();
  if (!existing) return notFound('取引が見つかりません');
  await env.DB.prepare(
    `UPDATE cashbook_transactions
     SET occurred_at = ?, amount = ?, kind = ?, category_id = ?, memo = ?, merchant_id = ?, is_credit_card = ?
     WHERE id = ? AND owner_id = ?`,
  )
    .bind(
      input.occurredAt,
      input.amount,
      input.kind,
      input.categoryId,
      input.memo || null,
      merchantId,
      input.isCreditCard ? 1 : 0,
      id,
      ownerId,
    )
    .run();
  return json({ ok: true });
}

async function handleSettings(request: CashbookRequest, env: AppEnv, ownerId: string): Promise<Response> {
  if (request.method === 'GET') return json(await readSettings(env.DB, ownerId));

  if (request.method === 'PUT') {
    const input = await readJson<{ currentBalance?: unknown }>(request);
    if (typeof input?.currentBalance !== 'number' || !Number.isInteger(input.currentBalance)) {
      return badRequest('現在の残高は整数で入力してください');
    }
    const rawBalance = await readRawBalance(env.DB, ownerId);
    const balanceAdjustment = input.currentBalance - rawBalance;
    await env.DB.prepare(
      `INSERT INTO cashbook_settings (owner_id, key, value, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(owner_id, key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
    )
      .bind(ownerId, BALANCE_ADJUSTMENT_KEY, String(balanceAdjustment))
      .run();
    return json({ currentBalance: input.currentBalance });
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare(`DELETE FROM cashbook_settings WHERE owner_id = ? AND key IN (?, 'initial_balance')`)
      .bind(ownerId, BALANCE_ADJUSTMENT_KEY)
      .run();
    return json({ currentBalance: await readRawBalance(env.DB, ownerId) });
  }

  return methodNotAllowed('GET, PUT, DELETE');
}

async function handleSummary(request: CashbookRequest, env: AppEnv, ownerId: string): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed('GET');
  const url = new URL(request.url);
  const months = clamp(Number(url.searchParams.get('months') || 12), 1, 24);
  const month = url.searchParams.get('month') || todayInJst().slice(0, 7);
  const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'month';
  const balanceAdjustment = await getBalanceAdjustment(env.DB, ownerId);
  const result = scope === 'all'
    ? await getAllPeriodSummary(env.DB, ownerId, month, balanceAdjustment)
    : await getMonthSummary(env.DB, ownerId, month, months, balanceAdjustment);

  const lastInput = (await env.DB.prepare(
    `SELECT strftime('%Y-%m-%dT%H:%M:%SZ', MAX(created_at)) AS lastInputAt
     FROM cashbook_transactions WHERE owner_id = ?`,
  )
    .bind(ownerId)
    .first<{ lastInputAt: string | null }>()) || { lastInputAt: null };
  const categoryWhere = scope === 'all'
    ? `WHERE t.owner_id = ? AND t.category_id != 'expense-payment-credit-card'`
    : `WHERE t.owner_id = ?
       AND strftime('%Y-%m', datetime(t.occurred_at, '+9 hours')) = ?
       AND t.category_id != 'expense-payment-credit-card'`;
  const categoryArgs = scope === 'all' ? [ownerId] : [ownerId, month];
  const { results: categoryBreakdown } = await env.DB.prepare(
    `SELECT
      COALESCE(p.id, c.id) AS categoryId,
      COALESCE(p.name, c.name) AS categoryName,
      NULL AS parentCategoryName,
      t.kind AS kind,
      SUM(t.amount) AS amount
     FROM cashbook_transactions t
     JOIN cashbook_categories c ON c.id = t.category_id AND c.owner_id = t.owner_id
     LEFT JOIN cashbook_categories p ON p.id = c.parent_id AND p.owner_id = t.owner_id
     ${categoryWhere}
     GROUP BY COALESCE(p.id, c.id), COALESCE(p.name, c.name), t.kind
     ORDER BY t.kind, amount DESC, categoryName`,
  )
    .bind(...categoryArgs)
    .all<CategoryBreakdownRow>();

  return json({ ...result, categoryBreakdown, lastInputAt: lastInput.lastInputAt });
}

async function handleGmail(
  request: CashbookRequest,
  env: AppEnv,
  user: SessionUser,
  parts: string[],
): Promise<Response> {
  if (parts[0] === 'starred' && parts.length === 1 && request.method === 'GET') {
    const url = new URL(request.url);
    const limit = clamp(Number(url.searchParams.get('limit') || 10), 1, 20);
    const accessToken = await getGmailAccessToken(env, user.id);
    const messages = await listStarredMessages(accessToken, limit);
    const candidates = await Promise.all(messages.map((message) => loadMessage(accessToken, message.id, user.email)));
    return json({ messages: candidates.filter(Boolean), totalEstimate: messages.length });
  }

  if (parts[0] === 'messages' && parts[2] === 'unstar' && parts.length === 3 && request.method === 'POST') {
    const messageId = decodePathPart(parts[1]);
    const accessToken = await getGmailAccessToken(env, user.id);
    const response = await fetchWithTimeout(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/modify`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['STARRED'] }),
      },
    );
    const data = (await response.json()) as { error?: { message?: string } };
    if (!response.ok) throw new AppError(data.error?.message || 'Gmailスターの解除に失敗しました。', response.status, 'GMAIL_UNSTAR_FAILED');
    return json({ ok: true });
  }

  return notFound('Gmail APIが見つかりません。');
}

async function listStarredMessages(accessToken: string, limit: number): Promise<{ id: string; threadId: string }[]> {
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
  url.searchParams.set('q', 'is:starred');
  url.searchParams.set('maxResults', String(limit));
  const response = await fetchWithTimeout(url.toString(), { headers: { authorization: `Bearer ${accessToken}` } });
  const data = (await response.json()) as GmailListResponse;
  if (!response.ok) throw new AppError(data.error?.message || 'Gmailのスター付きメール取得に失敗しました。', response.status, 'GMAIL_LIST_FAILED');
  return data.messages || [];
}

async function loadMessage(accessToken: string, id: string, userEmail: string): Promise<GmailCandidate | null> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}`);
  url.searchParams.set('format', 'metadata');
  for (const header of ['Subject', 'From', 'Date', 'Message-ID']) url.searchParams.append('metadataHeaders', header);
  const response = await fetchWithTimeout(url.toString(), { headers: { authorization: `Bearer ${accessToken}` } });
  const message = (await response.json()) as GmailMessageResponse;
  if (!response.ok) throw new AppError(message.error?.message || 'Gmailメール本文の取得に失敗しました。', response.status, 'GMAIL_MESSAGE_FAILED');

  const subject = headerValue(message, 'Subject');
  const from = headerValue(message, 'From');
  const messageId = headerValue(message, 'Message-ID') || null;
  const snippet = message.snippet || '';
  const amount = extractAmount(`${subject} ${snippet}`);
  return {
    id: message.id,
    threadId: message.threadId,
    messageId,
    gmailUrl: gmailMessageUrl(userEmail, message.threadId, messageId),
    subject,
    from,
    date: normalizeDate(headerValue(message, 'Date'), message.internalDate),
    snippet,
    amount,
    merchantName: extractMerchant(from, subject),
  };
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AppError('外部サービスへの接続がタイムアウトしました。', 504, 'EXTERNAL_TIMEOUT');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function listCategories(db: D1Database, ownerId: string): Promise<CategoryRow[]> {
  const { results } = await db.prepare(
    `SELECT id, parent_id AS parentId, kind, name, sort_order AS sortOrder
     FROM cashbook_categories WHERE owner_id = ?
     ORDER BY kind, parent_id IS NOT NULL, sort_order, name`,
  )
    .bind(ownerId)
    .all<CategoryRow>();
  return results;
}

async function seedPresetCategoriesIfEmpty(db: D1Database, ownerId: string): Promise<void> {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM cashbook_categories WHERE owner_id = ?`)
    .bind(ownerId)
    .first<{ count: number }>();
  if ((row?.count || 0) > 0) return;
  await db.batch(
    presetCategories.map(([id, parentId, kind, name, sortOrder]) => db.prepare(
      `INSERT OR IGNORE INTO cashbook_categories (id, owner_id, parent_id, kind, name, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(id, ownerId, parentId, kind, name, sortOrder)),
  );
}

async function findCategory(
  db: D1Database,
  ownerId: string,
  kind: TransactionKind,
  parentId: string | null,
  name: string,
): Promise<{ id: string } | null> {
  const query = parentId === null
    ? `SELECT id FROM cashbook_categories WHERE owner_id = ? AND kind = ? AND parent_id IS NULL AND name = ? LIMIT 1`
    : `SELECT id FROM cashbook_categories WHERE owner_id = ? AND kind = ? AND parent_id = ? AND name = ? LIMIT 1`;
  const args = parentId === null ? [ownerId, kind, name] : [ownerId, kind, parentId, name];
  return db.prepare(query).bind(...args).first<{ id: string }>();
}

async function nextSortOrder(db: D1Database, ownerId: string, kind: TransactionKind, parentId: string | null): Promise<number> {
  const query = parentId === null
    ? `SELECT COALESCE(MAX(sort_order), 0) + 10 AS sortOrder FROM cashbook_categories WHERE owner_id = ? AND kind = ? AND parent_id IS NULL`
    : `SELECT COALESCE(MAX(sort_order), 0) + 10 AS sortOrder FROM cashbook_categories WHERE owner_id = ? AND kind = ? AND parent_id = ?`;
  const args = parentId === null ? [ownerId, kind] : [ownerId, kind, parentId];
  const row = await db.prepare(query).bind(...args).first<{ sortOrder: number }>();
  return row?.sortOrder || 10;
}

async function listMerchants(db: D1Database, ownerId: string): Promise<MerchantRow[]> {
  const { results } = await db.prepare(
    `SELECT id, name FROM cashbook_merchants WHERE owner_id = ? ORDER BY name`,
  )
    .bind(ownerId)
    .all<MerchantRow>();
  return results;
}

async function findMerchant(db: D1Database, ownerId: string, name: string): Promise<MerchantRow | null> {
  return db.prepare(
    `SELECT id, name FROM cashbook_merchants WHERE owner_id = ? AND name = ? LIMIT 1`,
  )
    .bind(ownerId, name)
    .first<MerchantRow>();
}

async function findOrCreateMerchant(db: D1Database, ownerId: string, name: string | null | undefined): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const existing = await findMerchant(db, ownerId, trimmed);
  if (existing) return existing.id;
  const id = crypto.randomUUID();
  await db.prepare(`INSERT OR IGNORE INTO cashbook_merchants (id, owner_id, name) VALUES (?, ?, ?)`)
    .bind(id, ownerId, trimmed)
    .run();
  return (await findMerchant(db, ownerId, trimmed))?.id || id;
}

function validateTransactionInput(input: TransactionInput | null | undefined): string | null {
  if (!input || typeof input !== 'object') return '入力内容を確認してください';
  if (!input.occurredAt || Number.isNaN(Date.parse(input.occurredAt))) return '日時を入力してください';
  if (input.amount === undefined || !Number.isInteger(input.amount) || input.amount <= 0) return '金額は1円以上の整数で入力してください';
  if (input.kind !== 'income' && input.kind !== 'expense') return '入出金区分を選択してください';
  if (!input.categoryId) return 'カテゴリを選択してください';
  return null;
}

async function readSettings(db: D1Database, ownerId: string): Promise<{ currentBalance: number }> {
  const rawBalance = await readRawBalance(db, ownerId);
  return { currentBalance: rawBalance + await getBalanceAdjustment(db, ownerId) };
}

async function readRawBalance(db: D1Database, ownerId: string): Promise<number> {
  const row = await db.prepare(
    `SELECT balance_cumulative AS balance
     FROM cashbook_monthly_with_balance
     WHERE owner_id = ? ORDER BY year_month DESC LIMIT 1`,
  )
    .bind(ownerId)
    .first<{ balance: number }>();
  return row?.balance || 0;
}

async function getBalanceAdjustment(db: D1Database, ownerId: string): Promise<number> {
  const row = await db.prepare(
    `SELECT value FROM cashbook_settings
     WHERE owner_id = ? AND key IN ('balance_adjustment', 'initial_balance')
     ORDER BY CASE key WHEN 'balance_adjustment' THEN 0 ELSE 1 END LIMIT 1`,
  )
    .bind(ownerId)
    .first<{ value: string }>();
  return Number(row?.value || 0);
}

async function getMonthSummary(
  db: D1Database,
  ownerId: string,
  month: string,
  _months: number,
  balanceAdjustment: number,
): Promise<{ current: SummaryRow; monthly: SummaryRow[]; trendPeriod: 'daily' }> {
  const current = (await db.prepare(
    `SELECT year_month AS yearMonth, income, expense, net
     FROM cashbook_monthly_summary WHERE owner_id = ? AND year_month = ?`,
  )
    .bind(ownerId, month)
    .first<Omit<SummaryRow, 'balance'>>()) || { yearMonth: month, income: 0, expense: 0, net: 0 };
  const balance = (await db.prepare(
    `SELECT balance_cumulative AS balance FROM cashbook_monthly_with_balance
     WHERE owner_id = ? AND year_month <= ? ORDER BY year_month DESC LIMIT 1`,
  )
    .bind(ownerId, month)
    .first<{ balance: number }>()) || { balance: 0 };
  const balanceBeforeMonth = (await db.prepare(
    `SELECT balance_cumulative AS balance FROM cashbook_monthly_with_balance
     WHERE owner_id = ? AND year_month < ? ORDER BY year_month DESC LIMIT 1`,
  )
    .bind(ownerId, month)
    .first<{ balance: number }>()) || { balance: 0 };
  const { results } = await db.prepare(
    `SELECT
      strftime('%Y-%m-%d', datetime(occurred_at, '+9 hours')) AS yearMonth,
      COALESCE(SUM(CASE WHEN kind = 'income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN kind = 'expense' AND category_id != 'expense-payment-credit-card' THEN amount ELSE 0 END), 0) AS expense,
      COALESCE(SUM(CASE WHEN kind = 'income' THEN amount WHEN is_credit_card = 1 THEN 0 ELSE -amount END), 0) AS net,
      0 AS balance
     FROM cashbook_transactions
     WHERE owner_id = ? AND strftime('%Y-%m', datetime(occurred_at, '+9 hours')) = ?
     GROUP BY strftime('%Y-%m-%d', datetime(occurred_at, '+9 hours'))
     ORDER BY strftime('%Y-%m-%d', datetime(occurred_at, '+9 hours'))`,
  )
    .bind(ownerId, month)
    .all<SummaryRow>();
  const food = (await db.prepare(
    `SELECT COALESCE(SUM(t.amount), 0) AS amount
     FROM cashbook_transactions t
     JOIN cashbook_categories c ON c.id = t.category_id AND c.owner_id = t.owner_id
     WHERE t.owner_id = ? AND strftime('%Y-%m', datetime(t.occurred_at, '+9 hours')) = ?
       AND t.kind = 'expense' AND (c.id = 'expense-food' OR c.parent_id = 'expense-food')`,
  )
    .bind(ownerId, month)
    .first<{ amount: number }>()) || { amount: 0 };
  const monthDays = daysInMonth(month).length;
  const elapsedDays = elapsedDaysInMonth(month);
  const foodDailyAverage = elapsedDays > 0 ? food.amount / elapsedDays : 0;
  return {
    current: {
      ...current,
      balance: balanceAdjustment + balance.balance,
      foodDailyAverage,
      foodMonthlyForecast: foodDailyAverage * monthDays,
    },
    monthly: fillDailySummary(month, results, balanceAdjustment + balanceBeforeMonth.balance),
    trendPeriod: 'daily',
  };
}

async function getAllPeriodSummary(
  db: D1Database,
  ownerId: string,
  fallbackMonth: string,
  balanceAdjustment: number,
): Promise<{ current: SummaryRow; monthly: SummaryRow[]; trendPeriod: 'monthly' }> {
  const { results } = await db.prepare(
    `SELECT year_month AS yearMonth, income, expense, net, balance_cumulative AS balance
     FROM cashbook_monthly_with_balance WHERE owner_id = ? ORDER BY year_month DESC`,
  )
    .bind(ownerId)
    .all<SummaryRow>();
  const monthly = fillAllMonthlySummary(results, fallbackMonth, balanceAdjustment);
  const current = monthly.reduce<SummaryRow>(
    (total, row) => ({
      yearMonth: 'all',
      income: total.income + row.income,
      expense: total.expense + row.expense,
      net: total.net + row.net,
      balance: row.balance,
    }),
    { yearMonth: 'all', income: 0, expense: 0, net: 0, balance: balanceAdjustment },
  );
  return { current, monthly, trendPeriod: 'monthly' };
}

function fillDailySummary(month: string, rows: SummaryRow[], openingBalance: number): SummaryRow[] {
  const byDate = new Map(rows.map((row) => [row.yearMonth, row]));
  let carryBalance = openingBalance;
  return daysInMonth(month).map((date) => {
    const row = byDate.get(date);
    if (row) {
      carryBalance += row.net;
      return { ...row, balance: carryBalance };
    }
    return { yearMonth: date, income: 0, expense: 0, net: 0, balance: carryBalance };
  });
}

function fillAllMonthlySummary(rows: SummaryRow[], fallbackMonth: string, balanceAdjustment: number): SummaryRow[] {
  if (rows.length === 0) return [{ yearMonth: fallbackMonth, income: 0, expense: 0, net: 0, balance: balanceAdjustment }];
  const sortedRows = [...rows].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  const firstMonth = sortedRows[0].yearMonth;
  const latestMonth = sortedRows[sortedRows.length - 1].yearMonth;
  const lastMonth = latestMonth.localeCompare(fallbackMonth) >= 0 ? latestMonth : fallbackMonth;
  const byMonth = new Map(sortedRows.map((row) => [row.yearMonth, row]));
  let carryBalance = balanceAdjustment;
  return monthsBetween(firstMonth, monthDistance(firstMonth, lastMonth) + 1).map((yearMonth) => {
    const row = byMonth.get(yearMonth);
    if (row) {
      carryBalance = balanceAdjustment + row.balance;
      return { ...row, balance: carryBalance };
    }
    return { yearMonth, income: 0, expense: 0, net: 0, balance: carryBalance };
  });
}

function daysInMonth(month: string): string[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1));
  const nextMonthDay = new Date(Date.UTC(year, monthNumber, 1));
  const count = Math.round((nextMonthDay.getTime() - firstDay.getTime()) / 86_400_000);
  return Array.from({ length: count }, (_, index) => new Date(Date.UTC(year, monthNumber - 1, index + 1)).toISOString().slice(0, 10));
}

function elapsedDaysInMonth(month: string): number {
  const today = todayInJst();
  const currentMonth = today.slice(0, 7);
  if (month === currentMonth) return Number(today.slice(8, 10));
  if (month < currentMonth) return daysInMonth(month).length;
  return 0;
}

function monthsBetween(startMonth: string, count: number): string[] {
  const [year, monthNumber] = startMonth.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  return Array.from({ length: count }, (_, index) => new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1)).toISOString().slice(0, 7));
}

function monthDistance(startMonth: string, endMonth: string): number {
  const [startYear, startMonthNumber] = startMonth.split('-').map(Number);
  const [endYear, endMonthNumber] = endMonth.split('-').map(Number);
  return (endYear - startYear) * 12 + (endMonthNumber - startMonthNumber);
}

function todayInJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function decodePathPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new AppError('URLのパラメータが不正です。', 400, 'INVALID_PATH_PARAMETER');
  }
}

function headerValue(message: GmailMessageResponse, name: string): string {
  return message.payload?.headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function extractAmount(text: string): number | null {
  const candidates = [
    ...text.matchAll(/[¥￥]\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)/g),
    ...text.matchAll(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)\s*円/g),
  ]
    .map((match) => Number(match[1].replaceAll(',', '')))
    .filter((value) => Number.isInteger(value) && value > 0);
  return candidates[0] || null;
}

function normalizeDate(headerDate: string, internalDate?: string): string | null {
  const date = headerDate ? new Date(headerDate) : internalDate ? new Date(Number(internalDate)) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function extractMerchant(from: string, subject: string): string | null {
  const fromName = from.replace(/<[^>]+>/g, '').replaceAll('"', '').trim();
  return fromName || subject.split(/[【[]/)[0]?.trim() || null;
}

function gmailMessageUrl(userEmail: string, threadId: string, messageId: string | null): string {
  if (messageId) {
    return `https://mail.google.com/mail/u/0/?authuser=${encodeURIComponent(userEmail)}#search/${encodeURIComponent(`rfc822msgid:${messageId}`)}`;
  }
  return `https://mail.google.com/mail/u/0/?authuser=${encodeURIComponent(userEmail)}#all/${threadId}`;
}
