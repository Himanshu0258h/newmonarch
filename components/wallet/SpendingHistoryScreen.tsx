import React from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getWalletCardDisplayName, type WalletCard, type WalletTransaction } from '../../data/walletCards';
import { formatWalletCurrency } from '../../context/WalletCardsContext';
import { parseTransactionDateTime } from '../../data/transactions';

type Props = {
  card: WalletCard;
  onBack: () => void;
};

type TypeFilter = 'all' | 'expense' | 'income';

function transactionDate(transaction: WalletTransaction, now: Date): Date | null {
  const stored = Date.parse(transaction.timestamp ?? '');
  const timestamp = Number.isFinite(stored)
    ? stored
    : parseTransactionDateTime(transaction.detail, now);
  return timestamp > 0 ? new Date(timestamp) : null;
}

function isIncome(transaction: WalletTransaction) {
  return transaction.positive === true || transaction.type === 'income';
}

function dateGroupLabel(date: Date | null, fallback: string, now: Date) {
  if (!date) return fallback || 'Other';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function SpendingHistoryScreen({ card, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>('all');
  const now = React.useMemo(() => new Date(), [card.id]);
  const monthLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const monthTransactions = React.useMemo(
    () => card.transactions.filter((transaction) => {
      const date = transactionDate(transaction, now);
      return date !== null &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth();
    }),
    [card.transactions, now],
  );
  const visibleTransactions = React.useMemo(
    () => card.transactions.filter((transaction) => {
      if (typeFilter === 'all') return true;
      return typeFilter === 'income' ? isIncome(transaction) : !isIncome(transaction);
    }),
    [card.transactions, typeFilter],
  );
  const spendingTotal = monthTransactions.reduce(
    (total, transaction) =>
      total + (isIncome(transaction) || transaction.transferType === 'self' ? 0 : Math.abs(transaction.amount)),
    0,
  );
  const spendingCount = monthTransactions.filter(
    (transaction) => !isIncome(transaction) && transaction.transferType !== 'self',
  ).length;

  const groupedTransactions = React.useMemo(() => {
    const groups = new Map<string, { label: string; transactions: WalletTransaction[] }>();
    [...visibleTransactions]
      .sort((left, right) =>
        (transactionDate(right, now)?.getTime() ?? 0) -
        (transactionDate(left, now)?.getTime() ?? 0),
      )
      .forEach((transaction) => {
        const date = transactionDate(transaction, now);
        const label = dateGroupLabel(
          date,
          transaction.detail.split('·')[0]?.trim() || 'Other',
          now,
        );
        const key = date
          ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
          : label;
        const group = groups.get(key);
        if (group) group.transactions.push(transaction);
        else groups.set(key, { label, transactions: [transaction] });
      });
    return Array.from(groups, ([key, group]) => ({ key, ...group }));
  }, [now, visibleTransactions]);

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to wallet"
          onPress={onBack}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={21} color="#1C1C1E" />
        </Pressable>
        <Text style={styles.topTitle}>Spending</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.fixedContent}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.accountName}>{getWalletCardDisplayName(card)}</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryHeading}>
            <View>
              <Text style={styles.summaryLabel}>SPENDING THIS MONTH</Text>
              <Text style={styles.month}>{monthLabel}</Text>
            </View>
            <View style={styles.summaryIcon}>
              <Ionicons name="receipt-outline" size={19} color="#C63A13" />
            </View>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.total}>
            {formatWalletCurrency(spendingTotal, card.currency ?? 'INR')}
          </Text>
          <Text style={styles.transactionCount}>
            {spendingCount} {spendingCount === 1 ? 'expense' : 'expenses'}
          </Text>
        </View>
        <View style={styles.listHeading}>
          <Text style={styles.listTitle}>Transactions</Text>
          <Text style={styles.listCount}>{visibleTransactions.length}</Text>
        </View>
        <View style={styles.typeFilters}>
          {([
            ['all', 'All'],
            ['expense', 'Expenses'],
            ['income', 'Income'],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: typeFilter === value }}
              onPress={() => setTypeFilter(value)}
              style={[styles.typeChip, typeFilter === value && styles.typeChipSelected]}
            >
              <Text style={[styles.typeText, typeFilter === value && styles.typeTextSelected]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.listViewport}>
        <FlatList
          data={groupedTransactions}
          keyExtractor={(group) => group.key}
          style={styles.scroll}
          contentContainerStyle={[
            styles.transactionContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
          scrollEnabled
          nestedScrollEnabled
          removeClippedSubviews={false}
          bounces
          alwaysBounceVertical
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: group }) => (
            <View style={styles.dayGroup}>
              <Text style={styles.dayHeading}>{group.label}</Text>
              {group.transactions.map((transaction) => (
                <View key={transaction.id} style={styles.transactionRow}>
                  <View style={styles.transactionIcon}>
                    <Ionicons name={transaction.icon} size={19} color="#C63A13" />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text numberOfLines={1} style={styles.merchant}>
                      {transaction.merchant}
                    </Text>
                    <Text style={styles.detail}>{transaction.detail}</Text>
                  </View>
                  <Text style={[styles.amount, isIncome(transaction) && styles.income]}>
                    {isIncome(transaction) ? '+' : '−'}
                    {formatWalletCurrency(transaction.amount, card.currency ?? 'INR')}
                  </Text>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={24} color="#9B9BA1" />
              <Text style={styles.emptyText}>
                {typeFilter === 'income'
                  ? 'No income transactions found.'
                  : typeFilter === 'expense'
                    ? 'No expense transactions found.'
                    : 'No transactions found.'}
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flex: 1,
    zIndex: 5,
    elevation: 20,
    backgroundColor: '#FFF8F4',
  },
  topBar: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1ECE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    color: '#1C1C1E',
    fontSize: 17,
    fontWeight: '600',
  },
  topBarSpacer: {
    width: 40,
  },
  listViewport: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
  },
  fixedContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    flexShrink: 0,
  },
  transactionContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  eyebrow: {
    color: '#8B8B90',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  accountName: {
    color: '#1C1C1E',
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginTop: 6,
  },
  summaryCard: {
    marginTop: 22,
    padding: 20,
    borderRadius: 22,
    backgroundColor: '#0B1020',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#B83A1B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 5,
  },
  summaryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  month: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 6,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF0E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  total: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.7,
    marginTop: 18,
  },
  transactionCount: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    marginTop: 5,
  },
  listHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 10,
  },
  listTitle: {
    color: '#1C1C1E',
    fontSize: 19,
    fontWeight: '600',
  },
  listCount: {
    color: '#8B8B90',
    fontSize: 13,
    fontWeight: '600',
  },
  typeFilters: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  typeChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F1ECE9',
  },
  typeChipSelected: {
    backgroundColor: '#FCE1D7',
  },
  typeText: {
    color: '#6F625C',
    fontSize: 12,
    fontWeight: '500',
  },
  typeTextSelected: {
    color: '#C63A13',
    fontWeight: '700',
  },
  dayGroup: {
    marginTop: 10,
  },
  dayHeading: {
    color: '#8B8B90',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  transactionRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E8E2DE',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E7E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  merchant: {
    color: '#202124',
    fontSize: 15,
    fontWeight: '600',
  },
  detail: {
    color: '#8B8B90',
    fontSize: 12,
    marginTop: 4,
  },
  amount: {
    color: '#202124',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  income: {
    color: '#27805F',
  },
  emptyState: {
    minHeight: 170,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    color: '#858585',
    fontSize: 13,
  },
});

export default React.memo(SpendingHistoryScreen);
