import type { TransactionAttachment } from './transactions';

export type WalletCategory = 'transit' | 'credit' | 'debit';

export type WalletTransaction = {
  id: string;
  merchant: string;
  detail: string;
  amount: number;
  positive?: boolean;
  category?: string;
  transferType?: 'self' | 'person';
  type?: 'income' | 'expense';
  timestamp?: string;
  note?: string;
  attachment?: TransactionAttachment;
  isMock?: boolean;
  icon:
    | 'cafe'
    | 'basket'
    | 'train'
    | 'book'
    | 'car'
    | 'color-palette'
    | 'play'
    | 'bag'
    | 'restaurant'
    | 'medkit'
    | 'bus'
    | 'swap-horizontal';
};

export type WalletCard = {
  id: string;
  bank: string;
  displayName?: string | null;
  holder: string;
  type: string;
  category: WalletCategory;
  number: string;
  network: string;
  expiry?: string | null;
  currency?: string | null;
  lastUsedAt?: string | number | null;
  colors: readonly [string, string, ...string[]];
  balance: number;
  monthlySpend: number;
  creditLimit?: number;
  outstanding?: number;
  isDefault?: boolean;
  transactions: WalletTransaction[];
};

export function getWalletCardDisplayName(card: Pick<WalletCard, 'displayName' | 'bank'>) {
  const name = card.displayName?.trim() || card.bank.trim();
  return name.replace(/\s+(?:debit|credit)\s+card$/i, '').trim();
}

export function getWalletCardTypeLabel(card: Pick<WalletCard, 'type'>) {
  return card.type.trim().toUpperCase() === 'DEBIT'
    ? 'BANK ACCOUNT'
    : `${card.type.trim().toUpperCase()} CARD`;
}

export const MOCK_CASH_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'cash-mock-tea',
    merchant: 'Tea Stall',
    detail: 'Today · 09:00',
    amount: 40,
    icon: 'cafe',
    category: 'Food',
    isMock: true,
  },
  {
    id: 'cash-mock-auto',
    merchant: 'Auto Rickshaw',
    detail: 'Yesterday · 18:20',
    amount: 120,
    icon: 'car',
    category: 'Transport',
    isMock: true,
  },
  {
    id: 'cash-mock-groceries',
    merchant: 'Groceries',
    detail: 'Yesterday · 12:15',
    amount: 350,
    icon: 'basket',
    category: 'Groceries',
    isMock: true,
  },
  {
    id: 'cash-mock-atm',
    merchant: 'ATM withdrawal',
    detail: 'Today · 08:30',
    amount: 2000,
    positive: true,
    icon: 'bag',
    category: 'Income',
    isMock: true,
  },
];

export const walletCards: WalletCard[] = [
  {
    id: 'cash-wallet',
    bank: 'Cash Wallet',
    displayName: 'Cash Wallet',
    holder: '',
    type: 'CASH',
    category: 'debit',
    number: '',
    network: '',
    currency: 'INR',
    lastUsedAt: '2026-11-02T00:00:00.000Z',
    colors: ['#386B59', '#21483F', '#142E32'],
    balance: 0,
    monthlySpend: 0,
    transactions: MOCK_CASH_TRANSACTIONS,
  },
  {
    id: 'hdfc-debit',
    bank: 'HDFC BANK',
    displayName: 'HDFC BANK',
    holder: 'HIMANSHU SHARMA',
    type: 'DEBIT',
    category: 'debit',
    number: '•••• 4821',
    network: 'VISA',
    expiry: '08 / 32',
    currency: 'INR',
    lastUsedAt: '2026-11-01T18:42:00.000Z',
    colors: ['#145B75', '#18354D', '#101827'],
    balance: 284750.32,
    monthlySpend: 42380.5,
    transactions: [
      { id: 'hdfc-1', merchant: 'The Coffee House', detail: 'Today · 09:42', amount: 8.5, icon: 'cafe' },
      { id: 'hdfc-2', merchant: 'Fresh Market', detail: 'Yesterday · 18:20', amount: 64.25, icon: 'basket' },
      { id: 'hdfc-3', merchant: 'Metro Transit', detail: 'Yesterday · 08:15', amount: 3.2, icon: 'train' },
      { id: 'hdfc-4', merchant: 'Bookshop Central', detail: 'Jun 27 · 16:40', amount: 22.75, icon: 'book' },
    ],
  },
  {
    id: 'sbi-debit',
    bank: 'STATE BANK OF INDIA',
    displayName: 'STATE BANK OF INDIA',
    holder: 'HIMANSHU SHARMA',
    type: 'DEBIT',
    category: 'debit',
    number: '•••• 1907',
    network: 'RuPay',
    expiry: '11 / 31',
    currency: 'INR',
    lastUsedAt: '2026-10-30T12:15:00.000Z',
    colors: ['#386B59', '#21483F', '#142E32'],
    balance: 96340.75,
    monthlySpend: 18760.2,
    transactions: [
      { id: 'sbi-1', merchant: 'Bookshop Central', detail: 'Today · 11:06', amount: 28.9, icon: 'book' },
      { id: 'sbi-2', merchant: 'City Grocers', detail: 'Yesterday · 19:41', amount: 52.75, icon: 'basket' },
      { id: 'sbi-3', merchant: 'Ride Share', detail: 'Jun 28 · 14:30', amount: 16.4, icon: 'car' },
      { id: 'sbi-4', merchant: 'Metro Transit', detail: 'Jun 27 · 08:05', amount: 3.1, icon: 'train' },
    ],
  },
  {
    id: 'icici-credit',
    bank: 'ICICI BANK',
    displayName: 'ICICI BANK',
    holder: 'HIMANSHU SHARMA',
    type: 'CREDIT',
    category: 'credit',
    number: '•••• 7364',
    network: 'Mastercard',
    expiry: '04 / 33',
    currency: 'INR',
    lastUsedAt: '2026-11-01T21:08:00.000Z',
    colors: ['#7B3F9B', '#482F78', '#202043'],
    balance: 78210,
    monthlySpend: 56720.8,
    creditLimit: 250000,
    outstanding: 56720.8,
    transactions: [
      { id: 'icici-1', merchant: 'Adobe Creative Cloud', detail: 'Today · 09:42', amount: 59.99, icon: 'color-palette' },
      { id: 'icici-2', merchant: 'Streaming Plus', detail: 'Yesterday · 20:10', amount: 15.99, icon: 'play' },
      { id: 'icici-3', merchant: 'Online Store', detail: 'Jun 28 · 12:05', amount: 128.4, icon: 'bag' },
      { id: 'icici-4', merchant: 'Dinner & Co.', detail: 'Jun 27 · 20:30', amount: 74.2, icon: 'restaurant' },
    ],
  },
  {
    id: 'axis-debit',
    bank: 'AXIS BANK',
    displayName: 'AXIS BANK',
    holder: 'HIMANSHU SHARMA',
    type: 'DEBIT',
    category: 'debit',
    number: '•••• 2058',
    network: 'VISA',
    expiry: '09 / 32',
    currency: 'INR',
    lastUsedAt: '2026-10-31T09:30:00.000Z',
    colors: ['#B15B3E', '#743B4A', '#352540'],
    balance: 152680.4,
    monthlySpend: 31690,
    transactions: [
      { id: 'axis-1', merchant: 'Weekend Dining', detail: 'Today · 13:15', amount: 84.6, icon: 'restaurant' },
      { id: 'axis-2', merchant: 'Fuel Station', detail: 'Yesterday · 17:32', amount: 46.5, icon: 'car' },
      { id: 'axis-3', merchant: 'Pharmacy', detail: 'Jun 27 · 10:11', amount: 22.3, icon: 'medkit' },
      { id: 'axis-4', merchant: 'Fresh Market', detail: 'Jun 26 · 18:50', amount: 35.8, icon: 'basket' },
    ],
  },
  {
    id: 'monarch-transit',
    bank: 'MONARCH TRANSIT',
    displayName: 'Monarch Transit',
    holder: 'HIMANSHU SHARMA',
    type: 'TRANSIT',
    category: 'transit',
    number: '•••• 8840',
    network: 'NFC',
    expiry: '12 / 30',
    currency: 'INR',
    lastUsedAt: '2026-11-02T06:20:00.000Z',
    colors: ['#BD772C', '#965027', '#502D2A'],
    balance: 2450,
    monthlySpend: 890,
    transactions: [
      { id: 'transit-1', merchant: 'Metro Tap In', detail: 'Today · 08:42', amount: 2.75, icon: 'train' },
      { id: 'transit-2', merchant: 'City Bus', detail: 'Yesterday · 18:04', amount: 2.25, icon: 'bus' },
      { id: 'transit-3', merchant: 'Metro Tap In', detail: 'Jun 28 · 08:30', amount: 2.75, icon: 'train' },
      { id: 'transit-4', merchant: 'City Bus', detail: 'Jun 27 · 17:55', amount: 2.25, icon: 'bus' },
    ],
  },
];
