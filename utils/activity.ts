import type { Transaction } from '../data/transactions';
import { parseTransactionDateTime } from '../data/transactions';
import { getTransactionMode } from './transactionCategories';

export type ActivityFilter = 'all' | 'expense' | 'income';
export type ActivityDateRange = {
  start: Date;
  end: Date;
};

export type ActivityAccount = {
  id: string;
  name: string;
  number: string;
  network: string;
};

export type ActivitySection<T extends Transaction = Transaction> = {
  key: string;
  title: string;
  total: number;
  data: T[];
};

function localDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function localWeekStart(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  return start.getTime();
}

function transactionDate(transaction: Transaction) {
  const value = Date.parse(transaction.timestamp ?? transaction.createdAt ?? '');
  if (Number.isFinite(value)) return new Date(value);
  const parsed = parseTransactionDateTime(transaction.subtitle);
  return parsed > 0 ? new Date(parsed) : null;
}

export function inferRecurringTransactionIds(transactions: readonly Transaction[]) {
  const ids = new Set(
    transactions.filter((transaction) => transaction.isRecurring).map((transaction) => transaction.id),
  );
  const byMerchant = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = transaction.title.trim().toLocaleLowerCase();
    if (!key) continue;
    const group = byMerchant.get(key);
    if (group) group.push(transaction);
    else byMerchant.set(key, [transaction]);
  }

  byMerchant.forEach((items) => {
    const sorted = items
      .filter((item) => item.amount > 0 && transactionDate(item) !== null)
      .sort((left, right) => (transactionDate(left)?.getTime() ?? 0) - (transactionDate(right)?.getTime() ?? 0));
    const recurring = new Set<string>();
    for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
      const left = sorted[leftIndex];
      const leftDate = transactionDate(left);
      if (!leftDate) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
        const right = sorted[rightIndex];
        const rightDate = transactionDate(right);
        if (!rightDate || localWeekStart(leftDate) === localWeekStart(rightDate)) continue;
        const largerAmount = Math.max(left.amount, right.amount);
        if (largerAmount > 0 && Math.abs(left.amount - right.amount) / largerAmount <= 0.1) {
          recurring.add(left.id);
          recurring.add(right.id);
        }
      }
    }
    recurring.forEach((id) => ids.add(id));
  });
  return ids;
}

function normalizedAmountQuery(query: string) {
  return query.replace(/[₹$,\s]/g, '').toLocaleLowerCase();
}

function matchesSearch(
  transaction: Transaction,
  query: string,
  accounts: ReadonlyMap<string, ActivityAccount>,
) {
  const text = query.trim().toLocaleLowerCase();
  if (!text) return true;
  const account = transaction.accountId ? accounts.get(transaction.accountId) : undefined;
  const fields = [transaction.title, transaction.note, transaction.category, account?.name]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLocaleLowerCase();
  if (fields.includes(text)) return true;
  const amountQuery = normalizedAmountQuery(text);
  return amountQuery.length > 0 && transaction.amount.toFixed(2).includes(amountQuery);
}

export function filterActivityTransactions(
  transactions: readonly Transaction[],
  accounts: ReadonlyMap<string, ActivityAccount>,
  options: {
    filter: ActivityFilter;
    query: string;
    cardId?: string;
    dateRange?: ActivityDateRange;
  },
) {
  return transactions.filter((transaction) => {
    if (options.cardId && transaction.accountId !== options.cardId) return false;
    if (options.dateRange) {
      const date = transactionDate(transaction);
      const start = localDayStart(options.dateRange.start);
      const end = localDayStart(options.dateRange.end);
      if (!date || localDayStart(date) < start || localDayStart(date) > end) return false;
    }
    const mode = getTransactionMode(transaction);
    if (options.filter === 'expense' && mode !== 'expense') return false;
    if (options.filter === 'income' && mode !== 'income') return false;
    return matchesSearch(transaction, options.query, accounts);
  }).sort((left, right) => {
    const leftDate = transactionDate(left)?.getTime() ?? 0;
    const rightDate = transactionDate(right)?.getTime() ?? 0;
    return rightDate - leftDate;
  });
}

export function groupActivityByLocalDay<T extends Transaction>(transactions: readonly T[], now = new Date()): ActivitySection<T>[] {
  const today = localDayStart(now);
  const yesterday = today - 24 * 60 * 60 * 1000;
  const groups = new Map<string, { date: Date; rows: T[] }>();
  transactions.forEach((transaction) => {
    const date = transactionDate(transaction) ?? now;
    const key = String(localDayStart(date));
    const current = groups.get(key);
    if (current) current.rows.push(transaction);
    else groups.set(key, { date, rows: [transaction] });
  });

  return [...groups.entries()]
    .sort(([left], [right]) => Number(right) - Number(left))
    .map(([key, group]) => {
      const day = localDayStart(group.date);
      const title = day === today
        ? 'TODAY'
        : day === yesterday
          ? 'YESTERDAY'
          : group.date.toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }).toLocaleUpperCase();
      const data = [...group.rows].sort((left, right) => (
        (transactionDate(right)?.getTime() ?? 0) - (transactionDate(left)?.getTime() ?? 0)
      ));
      const total = data.reduce((sum, transaction) => (
        sum + (getTransactionMode(transaction) === 'income' ? transaction.amount : -transaction.amount)
      ), 0);
      return { key, title, total, data };
    });
}
