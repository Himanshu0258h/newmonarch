import { Ionicons } from '@expo/vector-icons';
import type { TransactionType } from '../data/transactions';
import type { WalletTransaction } from '../data/walletCards';

export type TransactionMode = 'income' | 'expense';
export const TRANSACTION_CATEGORIES_STORAGE_KEY = 'custom-transaction-categories-v1';
export const TRANSACTION_CATEGORY_OVERRIDES_KEY = 'transaction-category-overrides-v1';

export function transactionCategoryOverridesStorageKey(mode: TransactionMode) {
  return `${TRANSACTION_CATEGORY_OVERRIDES_KEY}-${mode}`;
}

export type TransactionCategory = {
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  homeType: TransactionType;
  walletIcon: WalletTransaction['icon'];
};

export const TRANSACTION_CATEGORIES: Record<TransactionMode, TransactionCategory[]> = {
  expense: [
    { name: 'Food and dining', icon: 'restaurant-outline', homeType: 'other', walletIcon: 'restaurant' },
    { name: 'Groceries', icon: 'basket-outline', homeType: 'other', walletIcon: 'basket' },
    { name: 'Transport', icon: 'train-outline', homeType: 'other', walletIcon: 'train' },
    { name: 'Fuel', icon: 'car-outline', homeType: 'other', walletIcon: 'car' },
    { name: 'Shopping', icon: 'bag-outline', homeType: 'other', walletIcon: 'bag' },
    { name: 'Bills and utilities', icon: 'receipt-outline', homeType: 'other', walletIcon: 'book' },
    { name: 'Rent', icon: 'home-outline', homeType: 'other', walletIcon: 'book' },
    { name: 'Entertainment', icon: 'film-outline', homeType: 'other', walletIcon: 'play' },
    { name: 'Health', icon: 'medkit-outline', homeType: 'other', walletIcon: 'medkit' },
    { name: 'Education', icon: 'school-outline', homeType: 'other', walletIcon: 'book' },
    { name: 'Travel', icon: 'airplane-outline', homeType: 'other', walletIcon: 'bus' },
    { name: 'Subscriptions', icon: 'repeat-outline', homeType: 'other', walletIcon: 'play' },
    { name: 'Transfers', icon: 'swap-horizontal-outline', homeType: 'other', walletIcon: 'bag' },
    { name: 'Other', icon: 'ellipsis-horizontal-circle-outline', homeType: 'other', walletIcon: 'color-palette' },
  ],
  income: [
    { name: 'Salary', icon: 'briefcase-outline', homeType: 'briefcase', walletIcon: 'bag' },
    { name: 'Freelance', icon: 'laptop-outline', homeType: 'other', walletIcon: 'book' },
    { name: 'Business', icon: 'business-outline', homeType: 'other', walletIcon: 'bag' },
    { name: 'Investments', icon: 'trending-up-outline', homeType: 'other', walletIcon: 'book' },
    { name: 'Refund', icon: 'return-down-back-outline', homeType: 'other', walletIcon: 'bag' },
    { name: 'Gift', icon: 'gift-outline', homeType: 'other', walletIcon: 'bag' },
    { name: 'Interest', icon: 'cash-outline', homeType: 'other', walletIcon: 'bag' },
    { name: 'Transfers', icon: 'swap-horizontal-outline', homeType: 'other', walletIcon: 'bag' },
    { name: 'Other', icon: 'ellipsis-horizontal-circle-outline', homeType: 'other', walletIcon: 'color-palette' },
  ],
};

export const TRANSACTION_CATEGORY_COLORS: Record<string, string> = {
  'Bills and utilities': '#22C55E',
  Education: '#10B981',
  EMI: '#6B7280',
  Entertainment: '#3B4BF0',
  'Food and dining': '#EF4444',
  Fuel: '#F59E0B',
  Groceries: '#65D31A',
  Health: '#F59E0B',
  Rent: '#64748B',
  Investments: '#475569',
  Other: '#F97316',
  Shopping: '#06B6D4',
  Transfers: '#8B2FC9',
  Travel: '#6D28D9',
  Salary: '#22C55E',
  Freelance: '#3B82F6',
  Business: '#0EA5E9',
  Gift: '#EC4899',
  Interest: '#14B8A6',
  Refund: '#F59E0B',
};

export function getTransactionMode(transaction: {
  mode?: TransactionMode;
  isPositive: boolean;
}): TransactionMode {
  return transaction.mode ?? (transaction.isPositive ? 'income' : 'expense');
}

export function categoryFor(mode: TransactionMode, name: string) {
  return TRANSACTION_CATEGORIES[mode].find((item) => item.name === name)
    ?? TRANSACTION_CATEGORIES[mode][TRANSACTION_CATEGORIES[mode].length - 1];
}
