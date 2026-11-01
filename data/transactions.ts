export type TransactionType = 'adobe' | 'stripe' | 'briefcase' | 'other';

export type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  isPositive: boolean;
  type: TransactionType;
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
