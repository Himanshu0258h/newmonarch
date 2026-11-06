import React from 'react';

import type { WalletCard, WalletTransaction } from '../data/walletCards';
import { formatWalletCurrency } from '../context/WalletCardsContext';
import type { ChartPoint } from '../utils/chartMath';

export type SpendingPeriod = 'week' | 'month' | 'year';
export const SCOPE: 'all' | 'activeCard' = 'activeCard';

type DatedTransaction = {
  amount: number;
  date: Date;
};

type SpendingData = {
  totalSpent: number;
  previousTotal: number;
  changePct: number;
  expenseTotal: number;
  series: ChartPoint[];
  highlightedIndex: number;
  isLoading: boolean;
  hasTransactions: boolean;
};

function localDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function transactionDate(detail: string, now: Date): Date | null {
  const normalized = detail.trim();
  if (/^today\b/i.test(normalized)) return localDay(now);
  if (/^yesterday\b/i.test(normalized)) {
    const yesterday = localDay(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  const monthDay = normalized.match(/\b([A-Za-z]{3,})\s+(\d{1,2})\b/);
  if (monthDay) {
    const parsed = new Date(`${monthDay[1]} ${monthDay[2]}, ${now.getFullYear()}`);
    return Number.isNaN(parsed.getTime()) ? null : localDay(parsed);
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : localDay(parsed);
}

function collectOutflows(cards: readonly WalletCard[], selectedCardId?: string): DatedTransaction[] {
  const now = new Date();
  const sourceCards =
    SCOPE === 'activeCard' && selectedCardId
      ? cards.filter((card) => card.id === selectedCardId)
      : cards;

  return sourceCards.flatMap((card) =>
    card.transactions.flatMap((transaction: WalletTransaction) => {
      if (transaction.positive || transaction.transferType === 'self') return [];
      const amount = Math.abs(Number(transaction.amount));
      const timestamp = Date.parse(transaction.timestamp ?? '');
      const date = Number.isFinite(timestamp)
        ? localDay(new Date(timestamp))
        : transactionDate(transaction.detail, now);
      if (!Number.isFinite(amount) || !date) return [];
      return [{ amount, date }];
    }),
  );
}

function periodBounds(period: SpendingPeriod, now: Date) {
  const today = localDay(now);
  if (period === 'week') {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - 7);
    const previousEnd = new Date(start);
    previousEnd.setDate(previousEnd.getDate() - 1);
    return { start, end: now, previousStart, previousEnd };
  }
  if (period === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    const previousStart = new Date(now.getFullYear() - 1, 0, 1);
    const previousEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return { start, end: now, previousStart, previousEnd };
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start, end: now, previousStart, previousEnd };
}

function sumWithin(transactions: readonly DatedTransaction[], start: Date, end: Date) {
  return transactions.reduce(
    (total, transaction) =>
      transaction.date >= start && transaction.date <= end
        ? total + transaction.amount
        : total,
    0,
  );
}

function createSeries(
  period: SpendingPeriod,
  transactions: readonly DatedTransaction[],
  now: Date,
): ChartPoint[] {
  if (period === 'week') {
    const today = localDay(now);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - 6 + index);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      return {
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        value: sumWithin(transactions, date, end),
      };
    });
  }
  if (period === 'year') {
    return Array.from({ length: 12 }, (_, month) => {
      const start = new Date(now.getFullYear(), month, 1);
      const end = new Date(now.getFullYear(), month + 1, 0, 23, 59, 59, 999);
      return {
        label: start.toLocaleDateString(undefined, { month: 'short' }),
        value: sumWithin(transactions, start, end),
      };
    });
  }

  const days = Math.min(now.getDate(), 30);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), index + 1);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return {
      label: String(index + 1),
      value: sumWithin(transactions, date, end),
    };
  });
}

export function useSpendingData(
  period: SpendingPeriod,
  cards: readonly WalletCard[],
  selectedCardId?: string,
  isLoading = false,
): SpendingData {
  return React.useMemo(() => {
    const now = new Date();
    const outflows = collectOutflows(cards, selectedCardId);
    const { start, end, previousStart, previousEnd } = periodBounds(period, now);
    const totalSpent = sumWithin(outflows, start, end);
    const previousTotal = sumWithin(outflows, previousStart, previousEnd);
    const changePct =
      previousTotal > 0 ? ((totalSpent - previousTotal) / previousTotal) * 100 : 0;
    const series = createSeries(period, outflows, now);
    const highlightedIndex =
      series.length > 0
        ? series.reduce(
            (maximumIndex, point, index) =>
              point.value > series[maximumIndex].value ? index : maximumIndex,
            0,
          )
        : -1;

    return {
      totalSpent,
      previousTotal,
      changePct,
      expenseTotal: totalSpent,
      series,
      highlightedIndex,
      isLoading,
      hasTransactions: SCOPE === 'activeCard' && selectedCardId
        ? Boolean(cards.find((card) => card.id === selectedCardId)?.transactions.length)
        : cards.some((card) => card.transactions.length > 0),
    };
  }, [cards, isLoading, period, selectedCardId]);
}

export function formatSpendingAmount(amount: number) {
  return formatWalletCurrency(amount, 'INR');
}
