import React from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  WalletCard,
  WalletTransaction,
  walletCards as initialWalletCards,
} from '../data/walletCards';
import {
  sortTransactionsByTimestamp,
  parseTransactionDateTime,
  transactionTimestamp,
  Transaction,
  transactions as initialTransactions,
} from '../data/transactions';

export type TransactionDeletionReceipt = {
  transaction: Transaction;
  removedWalletEntries: Array<{ accountId: string; transaction: WalletTransaction }>;
  balanceChanges: Array<{
    accountId: string;
    balanceDelta: number;
    monthlySpendDelta: number;
  }>;
};

type WalletCardsContextValue = {
  cards: WalletCard[];
  transactions: Transaction[];
  isLoading: boolean;
  replaceCards: (cards: WalletCard[]) => void;
  addCard: (card: WalletCard) => void;
  removeCard: (id: string) => void;
  updateCardBalance: (id: string, balance: number) => void;
  updateCard: (id: string, updates: Partial<WalletCard>) => void;
  reorderCards: (cards: WalletCard[]) => void;
  setDefaultCard: (id: string) => void;
  addTransaction: (id: string, transaction: WalletTransaction) => void;
  addFinancialTransaction: (
    transaction: Transaction,
    walletTransaction: WalletTransaction,
    balanceDelta: number,
    monthlySpendDelta: number,
  ) => Promise<void>;
  addTransferTransaction: (
    transaction: Transaction,
    sourceWalletTransaction: WalletTransaction,
    sourceAccountId: string,
    destinationAccountId: string | null,
    destinationWalletTransaction: WalletTransaction | null,
    monthlySpendDelta: number,
  ) => Promise<void>;
  undoFinancialTransaction: (
    transactionId: string,
    accountId: string,
    walletTransactionId: string,
    balanceDelta: number,
    monthlySpendDelta: number,
  ) => Promise<void>;
  updateTransaction: (transactionId: string, updates: Partial<Transaction>) => Promise<void>;
  editFinancialTransaction: (
    transactionId: string,
    updates: Pick<Partial<Transaction>, 'title' | 'amount' | 'note'>,
  ) => Promise<void>;
  deleteTransaction: (transactionId: string) => Promise<TransactionDeletionReceipt>;
  restoreDeletedTransaction: (receipt: TransactionDeletionReceipt) => Promise<void>;
  linkTransactionAccount: (transactionId: string, accountId: string) => Promise<void>;
  markCardUsed: (id: string) => void;
};

const WalletCardsContext = React.createContext<WalletCardsContextValue | null>(null);

function animateCardChanges() {
  LayoutAnimation.configureNext({
    duration: 300,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.spring, springDamping: 0.82 },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}

function adjustMoney(value: number, delta: number) {
  return (Math.round(value * 100) + Math.round(delta * 100)) / 100;
}

function transactionInCurrentMonth(transaction: Transaction) {
  const timestamp = transactionTimestamp(transaction);
  if (timestamp <= 0) return false;
  const date = new Date(timestamp);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function WalletCardsProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = React.useState<WalletCard[]>(initialWalletCards);
  const [transactions, setTransactions] = React.useState<Transaction[]>(initialTransactions);
  const [storageLoaded, setStorageLoaded] = React.useState(false);
  const hasHydrated = React.useRef(false);
  const pendingUpdates = React.useRef<Array<(current: WalletCard[]) => WalletCard[]>>([]);

  const updateCards = React.useCallback(
    (update: (current: WalletCard[]) => WalletCard[]) => {
      if (!hasHydrated.current) pendingUpdates.current.push(update);
      setCards(update);
    },
    [],
  );

  React.useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem('wallet-cards-v1'),
      AsyncStorage.getItem('wallet-transactions-v1'),
    ])
      .then(([storedCards, storedTransactions]) => {
        if (!active) return;
        let nextCards = initialWalletCards;
        let nextTransactions = initialTransactions;
        if (storedCards) {
          const parsed: unknown = JSON.parse(storedCards);
          if (
            !Array.isArray(parsed) ||
            parsed.some(
              (card) =>
                !card ||
                typeof card !== 'object' ||
                typeof card.id !== 'string' ||
                typeof card.bank !== 'string' ||
                !Array.isArray(card.transactions) ||
                !Array.isArray(card.colors)
            )
          ) {
            throw new Error('Stored wallet cards have an invalid format.');
          }
          nextCards = parsed as WalletCard[];
        }
        if (storedTransactions) {
          const parsed: unknown = JSON.parse(storedTransactions);
          if (
            !Array.isArray(parsed) ||
            parsed.some(
              (transaction) =>
                !transaction ||
                typeof transaction !== 'object' ||
                typeof transaction.id !== 'string' ||
                typeof transaction.title !== 'string' ||
                typeof transaction.subtitle !== 'string' ||
                typeof transaction.amount !== 'number' ||
                typeof transaction.isPositive !== 'boolean',
            )
          ) {
            throw new Error('Stored transactions have an invalid format.');
          }
          nextTransactions = parsed as Transaction[];
        }
        nextCards = pendingUpdates.current.reduce((current, update) => update(current), nextCards);
        pendingUpdates.current = [];
        hasHydrated.current = true;
        setCards(nextCards);
        setTransactions(sortTransactionsByTimestamp(nextTransactions));
        setStorageLoaded(true);
      })
      .catch((error: unknown) => {
        console.error('Could not load stored wallet cards.', error);
        if (active) {
          pendingUpdates.current = [];
          hasHydrated.current = true;
          setStorageLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!storageLoaded) return;
    AsyncStorage.setItem('wallet-cards-v1', JSON.stringify(cards)).catch((error: unknown) => {
      console.error('Could not persist wallet cards.', error);
    });
  }, [cards, storageLoaded]);

  React.useEffect(() => {
    if (!storageLoaded) return;
    AsyncStorage.setItem('wallet-transactions-v1', JSON.stringify(transactions)).catch((error: unknown) => {
      console.error('Could not persist transactions.', error);
    });
  }, [storageLoaded, transactions]);

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const replaceCards = React.useCallback((nextCards: WalletCard[]) => {
    animateCardChanges();
    updateCards(() => nextCards);
  }, [updateCards]);

  const addCard = React.useCallback((card: WalletCard) => {
    animateCardChanges();
    updateCards((current) => [...current, card]);
  }, [updateCards]);

  const removeCard = React.useCallback((id: string) => {
    updateCards((current) => current.filter((card) => card.id !== id));
  }, [updateCards]);

  const updateCardBalance = React.useCallback((id: string, balance: number) => {
    if (!Number.isFinite(balance)) {
      throw new Error(`Invalid balance for wallet card "${id}"`);
    }
    animateCardChanges();
    updateCards((current) =>
      current.map((card) =>
        card.id === id ? { ...card, balance, lastUsedAt: Date.now() } : card,
      ),
    );
  }, [updateCards]);

  const updateCard = React.useCallback((id: string, updates: Partial<WalletCard>) => {
    animateCardChanges();
    updateCards((current) =>
      current.map((card) => (card.id === id ? { ...card, ...updates, id: card.id } : card)),
    );
  }, [updateCards]);

  const reorderCards = React.useCallback((nextCards: WalletCard[]) => {
    const currentIds = new Set(cards.map((card) => card.id));
    if (
      nextCards.length !== cards.length ||
      nextCards.some((card) => !currentIds.has(card.id)) ||
      new Set(nextCards.map((card) => card.id)).size !== cards.length
    ) {
      throw new Error('Cannot reorder wallet cards with a different card set.');
    }
    animateCardChanges();
    const orderedIds = nextCards.map((card) => card.id);
    updateCards((current) => {
      const byId = new Map(current.map((card) => [card.id, card]));
      const ordered = orderedIds
        .map((id) => byId.get(id))
        .filter((card): card is WalletCard => card !== undefined);
      const orderedIdSet = new Set(orderedIds);
      return [...ordered, ...current.filter((card) => !orderedIdSet.has(card.id))];
    });
  }, [cards, updateCards]);

  const setDefaultCard = React.useCallback((id: string) => {
    if (!cards.some((card) => card.id === id)) {
      throw new Error(`Cannot set unknown wallet card "${id}" as default.`);
    }
    animateCardChanges();
    updateCards((current) =>
      current.map((card) => ({ ...card, isDefault: card.id === id })),
    );
  }, [cards, updateCards]);

  const addTransaction = React.useCallback(
    (id: string, transaction: WalletTransaction) => {
      if (!cards.some((card) => card.id === id)) {
        throw new Error(`Cannot add a transaction to unknown wallet card "${id}"`);
      }
      updateCards((current) =>
        current.map((card) =>
          card.id === id
            ? { ...card, transactions: [transaction, ...card.transactions] }
            : card,
        ),
      );
    },
    [cards, updateCards],
  );

  const addFinancialTransaction = React.useCallback(
    async (
      transaction: Transaction,
      walletTransaction: WalletTransaction,
      balanceDelta: number,
      monthlySpendDelta: number,
    ) => {
      const account = cards.find((card) => card.id === transaction.accountId);
      if (!account) {
        throw new Error('The selected account is no longer available.');
      }
      const nextTransactions = sortTransactionsByTimestamp([...transactions, transaction]);
      const nextCards = cards.map((card) => {
        if (card.id !== account.id) return card;
        const updatedWalletTransactions = [...card.transactions, walletTransaction].sort(
          (left, right) => {
            const timestamp = (item: WalletTransaction) => {
              const stored = Date.parse(item.timestamp ?? '');
              return Number.isFinite(stored) ? stored : parseTransactionDateTime(item.detail);
            };
            return timestamp(right) - timestamp(left);
          },
        );
        return {
          ...card,
          balance: adjustMoney(card.balance, balanceDelta),
          monthlySpend: adjustMoney(card.monthlySpend, monthlySpendDelta),
          lastUsedAt: Date.now(),
          transactions: updatedWalletTransactions,
        };
      });

      await Promise.all([
        AsyncStorage.setItem('wallet-cards-v1', JSON.stringify(nextCards)),
        AsyncStorage.setItem('wallet-transactions-v1', JSON.stringify(nextTransactions)),
      ]);
      animateCardChanges();
      setCards(nextCards);
      setTransactions(nextTransactions);
    },
    [cards, transactions],
  );

  const addTransferTransaction = React.useCallback(
    async (
      transaction: Transaction,
      sourceWalletTransaction: WalletTransaction,
      sourceAccountId: string,
      destinationAccountId: string | null,
      destinationWalletTransaction: WalletTransaction | null,
      monthlySpendDelta: number,
    ) => {
      const source = cards.find((card) => card.id === sourceAccountId);
      if (!source || transaction.accountId !== sourceAccountId) {
        throw new Error('The selected source account is no longer available.');
      }
      const destination = destinationAccountId
        ? cards.find((card) => card.id === destinationAccountId)
        : undefined;
      if (destinationAccountId && (!destination || destination.id === source.id || !destinationWalletTransaction)) {
        throw new Error('Choose a different destination account.');
      }
      const nextTransactions = sortTransactionsByTimestamp([...transactions, transaction]);
      const now = Date.now();
      const nextCards = cards.map((card) => {
        if (card.id === source.id) {
          const sourceTransactions = [...card.transactions, sourceWalletTransaction].sort(
            (left, right) => {
              const time = (item: WalletTransaction) => Date.parse(item.timestamp ?? '') || parseTransactionDateTime(item.detail);
              return time(right) - time(left);
            },
          );
          return {
            ...card,
            balance: adjustMoney(card.balance, -transaction.amount),
            monthlySpend: adjustMoney(card.monthlySpend, monthlySpendDelta),
            lastUsedAt: now,
            transactions: sourceTransactions,
          };
        }
        if (destination && card.id === destination.id && destinationWalletTransaction) {
          const destinationTransactions = [...card.transactions, destinationWalletTransaction].sort(
            (left, right) => {
              const time = (item: WalletTransaction) => Date.parse(item.timestamp ?? '') || parseTransactionDateTime(item.detail);
              return time(right) - time(left);
            },
          );
          return {
            ...card,
            balance: adjustMoney(card.balance, transaction.amount),
            lastUsedAt: now,
            transactions: destinationTransactions,
          };
        }
        return card;
      });

      await Promise.all([
        AsyncStorage.setItem('wallet-cards-v1', JSON.stringify(nextCards)),
        AsyncStorage.setItem('wallet-transactions-v1', JSON.stringify(nextTransactions)),
      ]);
      animateCardChanges();
      setCards(nextCards);
      setTransactions(nextTransactions);
    },
    [cards, transactions],
  );

  const undoFinancialTransaction = React.useCallback(
    async (
      transactionId: string,
      accountId: string,
      walletTransactionId: string,
      balanceDelta: number,
      monthlySpendDelta: number,
    ) => {
      const nextTransactions = transactions.filter((transaction) => transaction.id !== transactionId);
      const nextCards = cards.map((card) =>
        card.id === accountId
          ? {
              ...card,
              balance: adjustMoney(card.balance, -balanceDelta),
              monthlySpend: adjustMoney(card.monthlySpend, -monthlySpendDelta),
              transactions: card.transactions.filter(
                (transaction) => transaction.id !== walletTransactionId,
              ),
            }
          : card,
      );
      if (!cards.some((card) => card.id === accountId)) {
        throw new Error('The transaction account is no longer available.');
      }
      await Promise.all([
        AsyncStorage.setItem('wallet-cards-v1', JSON.stringify(nextCards)),
        AsyncStorage.setItem('wallet-transactions-v1', JSON.stringify(nextTransactions)),
      ]);
      animateCardChanges();
      setCards(nextCards);
      setTransactions(nextTransactions);
    },
    [cards, transactions],
  );

  const updateTransaction = React.useCallback(
    async (transactionId: string, updates: Partial<Transaction>) => {
      if (!transactions.some((transaction) => transaction.id === transactionId)) {
        throw new Error('The transaction is no longer available.');
      }
      const walletEntryIds = new Set([
        `${transactionId}-account`,
        `${transactionId}-out`,
        `${transactionId}-in`,
      ]);
      const nextCards = cards.map((card) => ({
        ...card,
        transactions: card.transactions.map((item) =>
          walletEntryIds.has(item.id)
            ? {
                ...item,
                ...(updates.title !== undefined ? { merchant: updates.title } : {}),
                ...(updates.category !== undefined ? { category: updates.category } : {}),
                ...(updates.note !== undefined ? { note: updates.note } : {}),
                ...(updates.attachment !== undefined ? { attachment: updates.attachment } : {}),
              }
            : item,
        ),
      }));
      const nextTransactions = transactions.map((transaction) =>
        transaction.id === transactionId
          ? { ...transaction, ...updates, id: transaction.id }
          : transaction,
      );
      await Promise.all([
        AsyncStorage.setItem('wallet-cards-v1', JSON.stringify(nextCards)),
        AsyncStorage.setItem('wallet-transactions-v1', JSON.stringify(nextTransactions)),
      ]);
      setCards(nextCards);
      setTransactions(nextTransactions);
    },
    [cards, transactions],
  );

  const editFinancialTransaction = React.useCallback(
    async (
      transactionId: string,
      updates: Pick<Partial<Transaction>, 'title' | 'amount' | 'note'>,
    ) => {
      const current = transactions.find((transaction) => transaction.id === transactionId);
      if (!current) throw new Error('The transaction is no longer available.');
      const amount = updates.amount ?? current.amount;
      const title = updates.title?.trim() ?? current.title;
      if (!Number.isFinite(amount) || amount <= 0 || !title) {
        throw new Error('Enter a valid merchant name and amount.');
      }

      const nextTransaction: Transaction = {
        ...current,
        ...updates,
        id: current.id,
        title,
        amount,
      };
      const amountDelta = nextTransaction.amount - current.amount;
      const balanceChanges = new Map<string, { balanceDelta: number; monthlySpendDelta: number }>();
      const walletUpdates = new Map<string, Partial<WalletTransaction>>();
      const setBalanceChange = (accountId: string, balanceDelta: number, monthlySpendDelta = 0) => {
        const change = balanceChanges.get(accountId) ?? { balanceDelta: 0, monthlySpendDelta: 0 };
        balanceChanges.set(accountId, {
          balanceDelta: change.balanceDelta + balanceDelta,
          monthlySpendDelta: change.monthlySpendDelta + monthlySpendDelta,
        });
      };
      const setWalletUpdate = (
        walletId: string,
        update: Partial<WalletTransaction>,
      ) => {
        walletUpdates.set(walletId, { ...walletUpdates.get(walletId), ...update });
      };
      const sharedWalletFields: Partial<WalletTransaction> = {
        amount: nextTransaction.amount,
        ...(nextTransaction.note ? { note: nextTransaction.note } : { note: undefined }),
      };

      if (current.transferType) {
        const sourceId = `${current.id}-out`;
        const sourceEntry = cards
          .find((card) => card.id === current.accountId)
          ?.transactions.find((item) => item.id === sourceId);
        if (sourceEntry && current.accountId) {
          setBalanceChange(
            current.accountId,
            -amountDelta,
            current.transferType === 'person' && transactionInCurrentMonth(current)
              ? amountDelta
              : 0,
          );
          setWalletUpdate(sourceId, { ...sharedWalletFields, merchant: nextTransaction.title });
        }
        const destinationId = `${current.id}-in`;
        const destinationEntry = current.destinationAccountId
          ? cards
              .find((card) => card.id === current.destinationAccountId)
              ?.transactions.find((item) => item.id === destinationId)
          : undefined;
        if (destinationEntry && current.destinationAccountId) {
          setBalanceChange(current.destinationAccountId, amountDelta);
          setWalletUpdate(destinationId, sharedWalletFields);
        }
      } else {
        const walletId = `${current.id}-account`;
        const linkedCard = current.accountId
          ? cards.find((card) => card.id === current.accountId)
          : undefined;
        const existingWalletTransaction = linkedCard?.transactions.find(
          (item) => item.id === walletId,
        );
        if (linkedCard && existingWalletTransaction) {
          const income = nextTransaction.mode
            ? nextTransaction.mode === 'income'
            : nextTransaction.isPositive;
          setBalanceChange(
            linkedCard.id,
            (income ? 1 : -1) * amountDelta,
            !income && transactionInCurrentMonth(current) ? amountDelta : 0,
          );
          setWalletUpdate(walletId, {
            ...sharedWalletFields,
            merchant: nextTransaction.title,
            positive: income,
          });
        }
      }

      const nextCards = cards.map((card) => {
        const change = balanceChanges.get(card.id);
        const hasWalletUpdate = card.transactions.some((item) => walletUpdates.has(item.id));
        if (!change && !hasWalletUpdate) return card;
        return {
          ...card,
          ...(change
            ? {
                balance: adjustMoney(card.balance, change.balanceDelta),
                monthlySpend: adjustMoney(card.monthlySpend, change.monthlySpendDelta),
              }
            : {}),
          transactions: card.transactions.map((item) => {
            const walletUpdate = walletUpdates.get(item.id);
            return walletUpdate ? { ...item, ...walletUpdate } : item;
          }),
        };
      });
      const nextTransactions = sortTransactionsByTimestamp(
        transactions.map((item) => item.id === current.id ? nextTransaction : item),
      );
      await Promise.all([
        AsyncStorage.setItem('wallet-cards-v1', JSON.stringify(nextCards)),
        AsyncStorage.setItem('wallet-transactions-v1', JSON.stringify(nextTransactions)),
      ]);
      if (balanceChanges.size > 0) animateCardChanges();
      setCards(nextCards);
      setTransactions(nextTransactions);
    },
    [cards, transactions],
  );

  const deleteTransaction = React.useCallback(
    async (transactionId: string) => {
      const transaction = transactions.find((item) => item.id === transactionId);
      if (!transaction) throw new Error('The transaction is no longer available.');

      const walletEntryIds = new Set([
        `${transaction.id}-account`,
        `${transaction.id}-out`,
        `${transaction.id}-in`,
      ]);
      const removedWalletEntries = cards.flatMap((card) =>
        card.transactions
          .filter((item) => walletEntryIds.has(item.id))
          .map((item) => ({ accountId: card.id, transaction: item })),
      );
      const balanceChanges = new Map<string, { balanceDelta: number; monthlySpendDelta: number }>();
      const addBalanceChange = (
        accountId: string,
        balanceDelta: number,
        monthlySpendDelta = 0,
      ) => {
        const current = balanceChanges.get(accountId) ?? { balanceDelta: 0, monthlySpendDelta: 0 };
        balanceChanges.set(accountId, {
          balanceDelta: current.balanceDelta + balanceDelta,
          monthlySpendDelta: current.monthlySpendDelta + monthlySpendDelta,
        });
      };

      if (transaction.transferType) {
        const sourceHasEntry = removedWalletEntries.some(
          (entry) => entry.accountId === transaction.accountId && entry.transaction.id === `${transaction.id}-out`,
        );
        if (transaction.accountId && sourceHasEntry) {
          addBalanceChange(
            transaction.accountId,
            transaction.amount,
            transaction.transferType === 'person' && transactionInCurrentMonth(transaction)
              ? -transaction.amount
              : 0,
          );
        }
        const destinationHasEntry = transaction.destinationAccountId
          ? removedWalletEntries.some(
              (entry) =>
                entry.accountId === transaction.destinationAccountId &&
                entry.transaction.id === `${transaction.id}-in`,
            )
          : false;
        if (transaction.destinationAccountId && destinationHasEntry) {
          addBalanceChange(transaction.destinationAccountId, -transaction.amount);
        }
      } else if (transaction.accountId) {
        const hasLinkedEntry = removedWalletEntries.some(
          (entry) => entry.accountId === transaction.accountId && entry.transaction.id === `${transaction.id}-account`,
        );
        if (hasLinkedEntry) {
          const income = transaction.mode
            ? transaction.mode === 'income'
            : transaction.isPositive;
          addBalanceChange(
            transaction.accountId,
            income ? -transaction.amount : transaction.amount,
            !income && transactionInCurrentMonth(transaction) ? -transaction.amount : 0,
          );
        }
      }

      for (const change of balanceChanges.keys()) {
        if (!cards.some((card) => card.id === change)) {
          throw new Error('A linked account is no longer available.');
        }
      }
      const nextCards = cards.map((card) => {
        const change = balanceChanges.get(card.id);
        const removedIds = new Set(
          removedWalletEntries
            .filter((entry) => entry.accountId === card.id)
            .map((entry) => entry.transaction.id),
        );
        if (!change && removedIds.size === 0) return card;
        return {
          ...card,
          ...(change
            ? {
                balance: adjustMoney(card.balance, change.balanceDelta),
                monthlySpend: adjustMoney(card.monthlySpend, change.monthlySpendDelta),
              }
            : {}),
          transactions: card.transactions.filter((item) => !removedIds.has(item.id)),
        };
      });
      const nextTransactions = transactions.filter((item) => item.id !== transaction.id);
      const receipt: TransactionDeletionReceipt = {
        transaction,
        removedWalletEntries,
        balanceChanges: [...balanceChanges.entries()].map(([accountId, change]) => ({
          accountId,
          ...change,
        })),
      };
      await Promise.all([
        AsyncStorage.setItem('wallet-cards-v1', JSON.stringify(nextCards)),
        AsyncStorage.setItem('wallet-transactions-v1', JSON.stringify(nextTransactions)),
      ]);
      animateCardChanges();
      setCards(nextCards);
      setTransactions(nextTransactions);
      return receipt;
    },
    [cards, transactions],
  );

  const restoreDeletedTransaction = React.useCallback(
    async (receipt: TransactionDeletionReceipt) => {
      if (transactions.some((item) => item.id === receipt.transaction.id)) {
        throw new Error('The transaction is already restored.');
      }
      for (const change of receipt.balanceChanges) {
        if (!cards.some((card) => card.id === change.accountId)) {
          throw new Error('A linked account is no longer available.');
        }
      }
      const entriesByAccount = new Map<string, WalletTransaction[]>();
      receipt.removedWalletEntries.forEach(({ accountId, transaction }) => {
        const entries = entriesByAccount.get(accountId) ?? [];
        entries.push(transaction);
        entriesByAccount.set(accountId, entries);
      });
      const nextCards = cards.map((card) => {
        const change = receipt.balanceChanges.find((item) => item.accountId === card.id);
        const restoredEntries = entriesByAccount.get(card.id) ?? [];
        if (!change && restoredEntries.length === 0) return card;
        const existingIds = new Set(card.transactions.map((item) => item.id));
        return {
          ...card,
          ...(change
            ? {
                balance: adjustMoney(card.balance, -change.balanceDelta),
                monthlySpend: adjustMoney(card.monthlySpend, -change.monthlySpendDelta),
              }
            : {}),
          transactions: [
            ...card.transactions,
            ...restoredEntries.filter((item) => !existingIds.has(item.id)),
          ].sort((left, right) => {
            const timestamp = (item: WalletTransaction) =>
              Date.parse(item.timestamp ?? '') || parseTransactionDateTime(item.detail);
            return timestamp(right) - timestamp(left);
          }),
        };
      });
      const nextTransactions = sortTransactionsByTimestamp([
        ...transactions,
        receipt.transaction,
      ]);
      await Promise.all([
        AsyncStorage.setItem('wallet-cards-v1', JSON.stringify(nextCards)),
        AsyncStorage.setItem('wallet-transactions-v1', JSON.stringify(nextTransactions)),
      ]);
      animateCardChanges();
      setCards(nextCards);
      setTransactions(nextTransactions);
    },
    [cards, transactions],
  );

  const linkTransactionAccount = React.useCallback(
    async (transactionId: string, accountId: string) => {
      if (!cards.some((card) => card.id === accountId)) {
        throw new Error('The selected account is no longer available.');
      }
      await updateTransaction(transactionId, { accountId });
    },
    [cards, updateTransaction],
  );

  const markCardUsed = React.useCallback((id: string) => {
    updateCards((current) =>
      current.map((card) =>
        card.id === id ? { ...card, lastUsedAt: Date.now() } : card,
      ),
    );
  }, [updateCards]);

  const value = React.useMemo(
    () => ({
      cards,
      transactions,
      isLoading: !storageLoaded,
      replaceCards,
      addCard,
      removeCard,
      updateCardBalance,
      updateCard,
      reorderCards,
      setDefaultCard,
      addTransaction,
      addFinancialTransaction,
      addTransferTransaction,
      undoFinancialTransaction,
      updateTransaction,
      editFinancialTransaction,
      deleteTransaction,
      restoreDeletedTransaction,
      linkTransactionAccount,
      markCardUsed,
    }),
    [cards, transactions, storageLoaded, replaceCards, addCard, removeCard, updateCardBalance, updateCard, reorderCards, setDefaultCard, addTransaction, addFinancialTransaction, addTransferTransaction, undoFinancialTransaction, updateTransaction, editFinancialTransaction, deleteTransaction, restoreDeletedTransaction, linkTransactionAccount, markCardUsed],
  );

  return (
    <WalletCardsContext.Provider value={value}>
      {children}
    </WalletCardsContext.Provider>
  );
}

export function useWalletCards() {
  const value = React.useContext(WalletCardsContext);
  if (!value) {
    throw new Error('useWalletCards must be used within WalletCardsProvider');
  }
  return value;
}

function numericBalance(balance: unknown) {
  const parsed = typeof balance === 'number' ? balance : Number(balance);
  return Number.isFinite(parsed) ? parsed : 0;
}

function recentUsageTimestamp(value: WalletCard['lastUsedAt']) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function getTopCards(cards: WalletCard[], count = 3) {
  return [...cards]
    .sort((left, right) => {
      const balanceDifference = numericBalance(right.balance) - numericBalance(left.balance);
      if (balanceDifference !== 0) return balanceDifference;

      const recentDifference =
        recentUsageTimestamp(right.lastUsedAt) - recentUsageTimestamp(left.lastUsedAt);
      if (recentDifference !== 0) return recentDifference;

      return (left.displayName ?? left.bank ?? '').localeCompare(
        right.displayName ?? right.bank ?? '',
      );
    })
    .slice(0, Math.max(0, count));
}

export function formatWalletCurrency(
  amount: number | string | null | undefined,
  currencyCode = 'INR',
) {
  const parsed = typeof amount === 'number' ? amount : Number(amount);
  const safeAmount = Number.isFinite(parsed) ? parsed : 0;
  const safeCurrency = /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : 'INR';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: safeCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeAmount);
}
