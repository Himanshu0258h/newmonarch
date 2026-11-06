import React from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ActionRow from '../components/ActionRow';
import BalanceHeader from '../components/BalanceHeader';
import BottomFadeBlur from '../components/BottomFadeBlur';
import BottomTabBar, { TabId } from '../components/BottomTabBar';
import MoneyTransferSheet from '../components/MoneyTransferSheet';
import TransactionItem from '../components/TransactionItem';
import TransactionSheet from '../components/TransactionSheet';
import WalletScreen from '../components/WalletScreen';
import ActivityScreen from './ActivityScreen';
import TransactionDetailsScreen from './TransactionDetailsScreen';
import {
  getTopCards,
  useWalletCards,
  type TransactionDeletionReceipt,
} from '../context/WalletCardsContext';
import { sortTransactionsByTimestamp, type Transaction } from '../data/transactions';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ActivityFilter } from '../utils/activity';

type AddedTransactionReceipt = {
  transaction: Transaction;
  accountId: string;
  walletTransactionId: string;
  balanceDelta: number;
  monthlySpendDelta: number;
};

type ToastUndo =
  | { kind: 'created'; receipt: AddedTransactionReceipt }
  | { kind: 'deleted'; receipt: TransactionDeletionReceipt };

export default function HomeScreen() {
  const [activeTab, setActiveTab] = React.useState<TabId>('card');
  const [walletFocusCardId, setWalletFocusCardId] = React.useState<string>();
  const [addCardRequest, setAddCardRequest] = React.useState(0);
  const [homeCardsExpanded, setHomeCardsExpanded] = React.useState(false);
  const [collapseCardStackRequest, setCollapseCardStackRequest] = React.useState(0);
  const [transactionSheetMode, setTransactionSheetMode] = React.useState<'income' | 'expense'>('expense');
  const [transactionSheetVisible, setTransactionSheetVisible] = React.useState(false);
  const [duplicateTransaction, setDuplicateTransaction] = React.useState<Transaction | null>(null);
  const [transferSheetVisible, setTransferSheetVisible] = React.useState(false);
  const [newTransactionId, setNewTransactionId] = React.useState<string | null>(null);
  const [activityRoute, setActivityRoute] = React.useState<{
    cardId?: string;
    initialFilter?: ActivityFilter;
  } | null>(null);
  const [selectedTransactionId, setSelectedTransactionId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ label: string; undo?: ToastUndo } | null>(null);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const safeAreaInsets = useSafeAreaInsets();
  const {
    cards,
    transactions,
    isLoading,
    addFinancialTransaction,
    addTransferTransaction,
    undoFinancialTransaction,
    restoreDeletedTransaction,
  } = useWalletCards();
  const topCards = React.useMemo(() => getTopCards(cards, 3), [cards]);
  const recentTransactions = React.useMemo(
    () => sortTransactionsByTimestamp(transactions),
    [transactions],
  );

  const openWallet = React.useCallback((cardId?: string) => {
    setWalletFocusCardId(cardId);
    setActiveTab('swap');
  }, []);
  const openActivity = React.useCallback((cardId?: string) => {
    setActivityRoute({ cardId });
  }, []);
  const closeActivity = React.useCallback(() => {
    setActivityRoute(null);
  }, []);
  const addExpenseFromActivity = React.useCallback(() => {
    setTransactionSheetMode('expense');
    setTransactionSheetVisible(true);
  }, []);

  React.useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const openTransaction = React.useCallback((mode: 'income' | 'expense') => {
    setTransactionSheetMode(mode);
    setDuplicateTransaction(null);
    setTransactionSheetVisible(true);
  }, []);
  const closeTransactionSheet = React.useCallback(() => {
    setTransactionSheetVisible(false);
    setDuplicateTransaction(null);
  }, []);
  const openDuplicateTransaction = React.useCallback((transaction: Transaction) => {
    setDuplicateTransaction(transaction);
    setTransactionSheetMode(
      transaction.mode ?? (transaction.isPositive ? 'income' : 'expense'),
    );
    setTransactionSheetVisible(true);
  }, []);
  const openAccountFromDetails = React.useCallback((cardId: string) => {
    setActivityRoute(null);
    setWalletFocusCardId(cardId);
    setActiveTab('swap');
  }, []);
  const openAddCardFromTransaction = React.useCallback(() => {
    setTransactionSheetVisible(false);
    setWalletFocusCardId(undefined);
    setActiveTab('swap');
    setAddCardRequest((request) => request + 1);
  }, []);

  const undoTransaction = React.useCallback(async () => {
    if (!toast?.undo) return;
    const undo = toast.undo;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
    try {
      if (undo.kind === 'created') {
        const { transaction, accountId, walletTransactionId, balanceDelta, monthlySpendDelta } = undo.receipt;
        await undoFinancialTransaction(
          transaction.id,
          accountId,
          walletTransactionId,
          balanceDelta,
          monthlySpendDelta,
        );
        setNewTransactionId(null);
      } else {
        await restoreDeletedTransaction(undo.receipt);
      }
    } catch {
      setToast({ label: "Couldn't undo. Try again.", undo });
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    }
  }, [restoreDeletedTransaction, toast, undoFinancialTransaction]);

  return (
    <View style={styles.appRoot}>
    <SafeAreaView
      style={[
        styles.safeArea,
        activeTab === 'swap' && styles.walletSafeArea,
        activeTab !== 'card' && activeTab !== 'swap' && styles.emptySafeArea,
        activityRoute && styles.hiddenHome,
      ]}
    >
      <StatusBar
        barStyle={activeTab === 'card' || activeTab === 'swap' ? 'light-content' : 'dark-content'}
      />

      <View style={[styles.screen, activeTab === 'swap' && styles.walletScreen]}>
        {activeTab === 'card' ? (
          <>
            <BalanceHeader
              cards={cards}
              isLoading={isLoading}
              onOpenWallet={openWallet}
              onCardStackExpandedChange={setHomeCardsExpanded}
              collapseCardStackRequest={collapseCardStackRequest}
              onCollapseCardStack={() =>
                setCollapseCardStackRequest((request) => request + 1)
              }
            />

            <View style={styles.contentSheet}>
              <ActionRow
                onDeposit={() => openTransaction('income')}
                onSwap={() => setTransferSheetVisible(true)}
                onWithdraw={() => openTransaction('expense')}
                isLoading={isLoading}
              />

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Transactions</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View all transactions"
                  onPress={() => openActivity()}
                  hitSlop={8}
                >
                  <Text style={styles.viewAll}>View All</Text>
                </Pressable>
              </View>

              <View style={styles.listWrap}>
                <FlatList
                  data={recentTransactions}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open transaction details for ${item.title}`}
                      onPress={() => setSelectedTransactionId(item.id)}
                    >
                      <TransactionItem item={item} newlyAdded={item.id === newTransactionId} />
                    </Pressable>
                  )}
                />
              </View>
            </View>
          </>
        ) : activeTab === 'swap' ? (
          <WalletScreen
            focusCardId={walletFocusCardId}
            openAddCardRequest={addCardRequest}
            onOpenActivity={openActivity}
            onOpenTransaction={setSelectedTransactionId}
          />
        ) : (
          <View style={styles.emptyPage} />
        )}
      </View>

      {activeTab === 'swap' && safeAreaInsets.bottom > 0 ? (
        <View
          pointerEvents="none"
          style={[styles.walletBottomSafeArea, { height: safeAreaInsets.bottom }]}
        />
      ) : null}
      {activeTab === 'card' || activeTab === 'swap' ? <BottomFadeBlur /> : null}

      {activeTab === 'card' && homeCardsExpanded && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Collapse cards"
          onPress={() => setCollapseCardStackRequest((request) => request + 1)}
          style={styles.expandedCardsDismissArea}
        />
      )}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <TransactionSheet
        mode={transactionSheetMode}
        visible={transactionSheetVisible}
        initialTransaction={duplicateTransaction}
        cards={cards}
        transactions={transactions}
        onClose={closeTransactionSheet}
        onAddCard={openAddCardFromTransaction}
        onSave={addFinancialTransaction}
        onSaved={(receipt) => {
          setNewTransactionId(receipt.transaction.id);
          setDuplicateTransaction(null);
          setToast({
            label: receipt.transaction.mode === 'income' ? 'Income added' : 'Expense added',
            undo: { kind: 'created', receipt },
          });
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 5000);
        }}
      />
      <MoneyTransferSheet
        visible={transferSheetVisible}
        cards={cards}
        onClose={() => setTransferSheetVisible(false)}
        onSave={addTransferTransaction}
        onSaved={(transaction) => {
          setNewTransactionId(transaction.id);
          setToast({ label: 'Money sent' });
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 5000);
        }}
      />
    </SafeAreaView>
    {activityRoute ? (
      <ActivityScreen
        cardId={activityRoute.cardId}
        initialFilter={activityRoute.initialFilter}
        onBack={closeActivity}
        onAddExpense={addExpenseFromActivity}
        onOpenTransaction={setSelectedTransactionId}
      />
    ) : null}
    {selectedTransactionId ? (
      <TransactionDetailsScreen
        transactionId={selectedTransactionId}
        onBack={() => setSelectedTransactionId(null)}
        onDuplicate={openDuplicateTransaction}
        onOpenAccount={openAccountFromDetails}
        onDeleted={(receipt) => {
          setToast({ label: 'Transaction deleted', undo: { kind: 'deleted', receipt } });
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 5000);
        }}
      />
    ) : null}
    {toast ? (
      <View
        style={[
          styles.toast,
          {
            bottom: safeAreaInsets.bottom + (activityRoute ? 24 : 118),
          },
        ]}
      >
        <Text style={styles.toastText}>{toast.label}</Text>
        {toast.undo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo transaction change"
            onPress={() => { void undoTransaction(); }}
          >
            <Text style={styles.undoText}>Undo</Text>
          </Pressable>
        ) : null}
      </View>
    ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  hiddenHome: {
    display: 'none',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#7A0A00',
  },
  emptySafeArea: {
    backgroundColor: '#FFFFFF',
  },
  walletSafeArea: {
    backgroundColor: '#7A0A00',
  },
  walletBottomSafeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
  },
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  walletScreen: {
    backgroundColor: '#FFF8F5',
  },
  emptyPage: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingHorizontal: 24,
  },
  contentSheet: {
    flex: 1,
    marginTop: -18,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    zIndex: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: 18,
  },
  expandedCardsDismissArea: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    marginTop: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '400',
    color: '#1C1C1E',
    letterSpacing: -0.4,
  },
  viewAll: {
    fontSize: 18,
    fontWeight: '400',
    color: '#8B8B90',
    letterSpacing: -0.3,
  },
  listWrap: {
    flex: 1,
    position: 'relative',
  },
  listContent: {
    paddingBottom: 140,
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 20,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: '#222329',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  undoText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
