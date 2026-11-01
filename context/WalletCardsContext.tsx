import React from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';

import { WalletCard, walletCards as initialWalletCards } from '../data/walletCards';

type WalletCardsContextValue = {
  cards: WalletCard[];
  isLoading: boolean;
  replaceCards: (cards: WalletCard[]) => void;
  addCard: (card: WalletCard) => void;
  updateCardBalance: (id: string, balance: number) => void;
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

export function WalletCardsProvider({ children }: { children: React.ReactNode }) {
  const [cards, setCards] = React.useState<WalletCard[]>(initialWalletCards);

  React.useEffect(() => {
    if (Platform.OS === 'android') {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const replaceCards = React.useCallback((nextCards: WalletCard[]) => {
    animateCardChanges();
    setCards(nextCards);
  }, []);

  const addCard = React.useCallback((card: WalletCard) => {
    animateCardChanges();
    setCards((current) => [...current, card]);
  }, []);

  const updateCardBalance = React.useCallback((id: string, balance: number) => {
    if (!Number.isFinite(balance)) {
      throw new Error(`Invalid balance for wallet card "${id}"`);
    }
    animateCardChanges();
    setCards((current) =>
      current.map((card) =>
        card.id === id ? { ...card, balance, lastUsedAt: Date.now() } : card,
      ),
    );
  }, []);

  const markCardUsed = React.useCallback((id: string) => {
    setCards((current) =>
      current.map((card) =>
        card.id === id ? { ...card, lastUsedAt: Date.now() } : card,
      ),
    );
  }, []);

  const value = React.useMemo(
    () => ({
      cards,
      isLoading: false,
      replaceCards,
      addCard,
      updateCardBalance,
      markCardUsed,
    }),
    [cards, replaceCards, addCard, updateCardBalance, markCardUsed],
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
