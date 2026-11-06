export type TransactionType = 'adobe' | 'stripe' | 'briefcase' | 'other';

export type TransactionAttachment = {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

export type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  isPositive: boolean;
  type: TransactionType;
  mode?: 'income' | 'expense';
  accountId?: string;
  timestamp?: string;
  createdAt?: string;
  category?: string;
  tags?: string[];
  note?: string;
  attachment?: TransactionAttachment;
  destinationAccountId?: string;
  transferType?: 'self' | 'person';
  isRecurring?: boolean;
};

export const transactions: Transaction[] = [
  {
    id: 'adobe-creative-cloud',
    title: 'Adobe Creative Cloud',
    subtitle: 'Today, 09:42',
    amount: 59.99,
    isPositive: false,
    type: 'adobe',
  },
  {
    id: 'stripe-payout',
    title: 'Stripe Payout',
    subtitle: 'Today, 08:15',
    amount: 100000,
    isPositive: true,
    type: 'stripe',
  },
  {
    id: 'office-supplies',
    title: 'Office Supplies',
    subtitle: 'Jun 28, 10:22',
    amount: 24.0,
    isPositive: true,
    type: 'briefcase',
  },
  {
    id: 'adobe-creative-cloud-copy',
    title: 'Adobe Creative Cloud',
    subtitle: 'Today, 09:42',
    amount: 59.99,
    isPositive: false,
    type: 'adobe',
  },
  {
    id: 'stripe-payout-copy',
    title: 'Stripe Payout',
    subtitle: 'Today, 08:15',
    amount: 100000,
    isPositive: true,
    type: 'stripe',
  },
  {
    id: 'office-supplies-copy',
    title: 'Office Supplies',
    subtitle: 'Jun 28, 10:22',
    amount: 24.0,
    isPositive: true,
    type: 'briefcase',
  },
];

export function transactionTimestamp(transaction: Transaction, now = new Date()) {
  if (transaction.timestamp) {
    const stored = Date.parse(transaction.timestamp);
    if (Number.isFinite(stored)) return stored;
  }

  return parseTransactionDateTime(transaction.subtitle, now);
}

export function parseTransactionDateTime(value: string, now = new Date()) {
  const subtitle = value.trim();
  const timeMatch = subtitle.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  let date: Date;
  if (/^today\b/i.test(subtitle)) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (/^yesterday\b/i.test(subtitle)) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  } else {
    const dayMatch = subtitle.match(/\b([A-Za-z]{3,})\s+(\d{1,2})\b/);
    if (!dayMatch) return 0;
    date = new Date(`${dayMatch[1]} ${dayMatch[2]}, ${now.getFullYear()}`);
    if (date.getTime() > now.getTime()) date.setFullYear(date.getFullYear() - 1);
  }

  if (timeMatch) {
    let hours = Number(timeMatch[1]);
    const minutes = Number(timeMatch[2]);
    const meridiem = timeMatch[3]?.toUpperCase();
    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    date.setHours(hours, minutes, 0, 0);
  }
  return date.getTime();
}

export function sortTransactionsByTimestamp(items: readonly Transaction[]) {
  return [...items].sort((left, right) => transactionTimestamp(right) - transactionTimestamp(left));
}
