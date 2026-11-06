import type { WalletCard } from '../data/walletCards';

export type CardDraft = {
  bank: string;
  holder: string;
  accountNumber: string;
  type: 'debit' | 'credit';
  balance: number;
  network: 'VISA' | 'Mastercard' | 'RuPay';
};

export type CardDraftErrors = Partial<Record<keyof CardDraft, string>>;

export function validateCardDraft(draft: CardDraft): CardDraftErrors {
  const errors: CardDraftErrors = {};
  const bank = draft.bank.trim();
  const holder = draft.holder.trim();

  if (!bank) errors.bank = 'Enter a bank name.';
  else if (bank.length > 30) errors.bank = 'Bank name must be 30 characters or fewer.';

  if (!holder) errors.holder = 'Enter the card holder name.';
  else if (holder.length > 26) errors.holder = 'Name must be 26 characters or fewer.';
  else if (!/^[a-zA-Z ]+$/.test(holder)) errors.holder = 'Use letters and spaces only.';

  if (!/^\d{4}$/.test(draft.accountNumber)) {
    errors.accountNumber = draft.type === 'debit'
      ? 'Enter the last 4 account digits.'
      : 'Enter the last 4 card digits.';
  }
  if (!Number.isFinite(draft.balance) || draft.balance < 0) {
    errors.balance = 'Enter a valid balance of zero or more.';
  }
  return errors;
}

export function hasDuplicateCard(cards: readonly WalletCard[], draft: CardDraft, exceptId?: string) {
  const bank = draft.bank.trim().toLocaleLowerCase();
  const accountSuffix = draft.accountNumber.slice(-4);
  return cards.some(
    (card) =>
      card.id !== exceptId &&
      card.bank.trim().toLocaleLowerCase() === bank &&
      card.number.replace(/\D/g, '').slice(-4) === accountSuffix,
  );
}
