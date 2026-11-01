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
import TransactionItem from '../components/TransactionItem';
import WalletScreen from '../components/WalletScreen';
import { getTopCards, useWalletCards } from '../context/WalletCardsContext';
import { transactions } from '../data/transactions';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = React.useState<TabId>('card');
  const [walletFocusCardId, setWalletFocusCardId] = React.useState<string>();
  const [homeCardsExpanded, setHomeCardsExpanded] = React.useState(false);
  const [collapseCardStackRequest, setCollapseCardStackRequest] = React.useState(0);
  const { cards, isLoading } = useWalletCards();
  const topCards = React.useMemo(() => getTopCards(cards, 3), [cards]);

  const openWallet = React.useCallback((cardId?: string) => {
    setWalletFocusCardId(cardId);
    setActiveTab('swap');
  }, []);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        activeTab === 'swap' && styles.walletSafeArea,
        activeTab !== 'card' && activeTab !== 'swap' && styles.emptySafeArea,
      ]}
    >
      <StatusBar barStyle={activeTab === 'card' || activeTab === 'swap' ? 'light-content' : 'dark-content'} />

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
              <ActionRow onDeposit={() => {}} onSwap={() => {}} onWithdraw={() => {}} />

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Transactions</Text>
                <Text style={styles.viewAll}>View All</Text>
              </View>

              <View style={styles.listWrap}>
                <FlatList
                  data={transactions}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderItem={({ item }) => <TransactionItem item={item} />}
                />
              </View>
            </View>
          </>
        ) : activeTab === 'swap' ? (
          <WalletScreen focusCardId={walletFocusCardId ?? topCards[0]?.id} />
        ) : (
          <View style={styles.emptyPage} />
        )}
      </View>

      {activeTab === 'card' && <BottomFadeBlur />}
      {activeTab === 'card' && homeCardsExpanded && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Collapse cards"
          onPress={() => setCollapseCardStackRequest((request) => request + 1)}
          style={styles.expandedCardsDismissArea}
        />
      )}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#7A0A00',
  },
  emptySafeArea: {
    backgroundColor: '#FFFFFF',
  },
  walletSafeArea: {
    backgroundColor: '#080B12',
  },
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  walletScreen: {
    backgroundColor: '#080B12',
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
});
