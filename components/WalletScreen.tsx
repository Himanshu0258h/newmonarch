import React from 'react';
import {
  Animated,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';

import {
  WalletCard as WalletCardData,
  WalletCategory,
} from '../data/walletCards';
import {
  formatWalletCurrency,
  useWalletCards,
} from '../context/WalletCardsContext';

const categories: { id: WalletCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'transit', label: 'Transit', icon: 'train-outline' },
  { id: 'credit', label: 'Credit', icon: 'card-outline' },
  { id: 'debit', label: 'Debit', icon: 'wallet-outline' },
];

const currency = (amount: number, currencyCode = 'INR') =>
  formatWalletCurrency(amount, currencyCode);

const cardPalettes = [
  ['#145B75', '#18354D', '#101827'],
  ['#7B3F9B', '#482F78', '#202043'],
  ['#386B59', '#21483F', '#142E32'],
  ['#B15B3E', '#743B4A', '#352540'],
  ['#BD772C', '#965027', '#502D2A'],
] as const;

function WalletCard({
  card,
  index,
  selected,
  showBalanceFace,
}: {
  card: WalletCardData;
  index: number;
  selected: boolean;
  showBalanceFace: boolean;
}) {
  const entrance = React.useRef(new Animated.Value(0)).current;
  const flip = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      delay: index * 90,
      useNativeDriver: true,
      tension: 55,
      friction: 9,
    }).start();
  }, [entrance]);

  React.useEffect(() => {
    Animated.spring(flip, {
      toValue: showBalanceFace ? 1 : 0,
      useNativeDriver: true,
      tension: 55,
      friction: 9,
    }).start();
  }, [flip, showBalanceFace]);

  const frontRotation = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotation = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const brand = card.network === 'Mastercard' ? (
    <View style={styles.mastercardMark}>
      <View style={[styles.mastercardCircle, styles.mastercardRed]} />
      <View style={[styles.mastercardCircle, styles.mastercardGold]} />
    </View>
  ) : (
    <Text style={styles.cardNetwork}>{card.network}</Text>
  );
  const isCashWallet = !card.number.trim();

  return (
    <Animated.View
      style={[
        styles.bankCard,
        selected && {
          shadowColor: card.colors[0],
          shadowOpacity: 0.4,
          shadowRadius: 22,
          elevation: 14,
          borderColor: `${card.colors[0]}80`,
        },
        {
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [22, 0],
              }),
            },
            { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.cardFace,
          { transform: [{ perspective: 1000 }, { rotateY: frontRotation }] },
        ]}
      >
        <LinearGradient
          colors={card.colors}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardLight} />
        <View style={styles.cardFaceContent}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.bankName}>{card.displayName || card.bank}</Text>
              {!isCashWallet && <Text style={styles.cardType}>{card.type} CARD</Text>}
            </View>
            {!isCashWallet && <Feather name="wifi" size={22} color="rgba(255,255,255,0.78)" />}
          </View>
          {!isCashWallet && (
            <>
              <View style={styles.chip}>
                <View style={styles.chipLineVertical} />
                <View style={styles.chipLineHorizontal} />
              </View>
              <Text style={styles.cardNumber}>{card.number}</Text>
              <View style={styles.cardBottom}>
                <Text style={styles.cardHolder}>{card.holder}</Text>
                {brand}
              </View>
            </>
          )}
        </View>
      </Animated.View>
      <Animated.View
        style={[
          styles.cardBackFace,
          { transform: [{ perspective: 1000 }, { rotateY: backRotation }] },
        ]}
      >
        <LinearGradient
          colors={[card.colors[1] ?? card.colors[0], card.colors[2] ?? card.colors[0]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.balanceFaceContent}>
          <Text style={styles.balanceFaceLabel}>{card.displayName || card.bank}</Text>
          <Text style={styles.balanceFaceCaption}>AVAILABLE BALANCE</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.balanceFaceValue}>
            {currency(card.balance, card.currency ?? 'INR')}
          </Text>
          {isCashWallet ? null : (
            <Text style={styles.balanceFaceNumber}>{card.number}</Text>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

type WalletScreenProps = {
  focusCardId?: string;
};

export default function WalletScreen({ focusCardId }: WalletScreenProps) {
  const { cards, addCard, markCardUsed } = useWalletCards();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.82, 340);
  const cardOverlap = 42;
  const snapInterval = cardWidth - cardOverlap;
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const carouselRef = React.useRef<React.ComponentRef<typeof Animated.ScrollView>>(null);
  const rotation = React.useRef(new Animated.Value(0)).current;
  const glow = React.useRef(new Animated.Value(1)).current;
  const [category, setCategory] = React.useState<WalletCategory>('debit');
  const [selectedId, setSelectedId] = React.useState('hdfc-debit');
  const [showAllTransactions, setShowAllTransactions] = React.useState(false);
  const [balanceFaceCardId, setBalanceFaceCardId] = React.useState<string | null>(null);
  const [balancesUnlocked, setBalancesUnlocked] = React.useState(false);
  const [hasShownSwipeTip, setHasShownSwipeTip] = React.useState(false);
  const [swipeTipVisible, setSwipeTipVisible] = React.useState(false);
  const authenticationInProgress = React.useRef(false);
  const [addCardVisible, setAddCardVisible] = React.useState(false);
  const [newBankName, setNewBankName] = React.useState('');
  const [newLastFour, setNewLastFour] = React.useState('');
  const [newBalance, setNewBalance] = React.useState('');
  const [newCardType, setNewCardType] = React.useState<'debit' | 'credit'>('debit');
  const [newNetwork, setNewNetwork] = React.useState<'VISA' | 'Mastercard' | 'RuPay'>('VISA');
  const [newPaletteIndex, setNewPaletteIndex] = React.useState(0);

  const visibleCards = React.useMemo(
    () => cards.filter((card) => card.category === category),
    [cards, category],
  );
  const selectedCard =
    visibleCards.find((card) => card.id === selectedId) ?? visibleCards[0];
  const selectedIndex = selectedCard
    ? visibleCards.findIndex((card) => card.id === selectedCard.id)
    : 0;
  const insets = (width - cardWidth) / 2;
  const selectedTransactions = selectedCard?.transactions ?? [];
  const maxTransactions = showAllTransactions
    ? selectedTransactions.length
    : Math.min(3, selectedTransactions.length);
  const creditAvailable = selectedCard?.creditLimit
    ? selectedCard.creditLimit - (selectedCard.outstanding ?? 0)
    : undefined;
  const spendingProgress = selectedCard
    ? Math.min(
        selectedCard.monthlySpend / (selectedCard.creditLimit ?? selectedCard.balance),
        1,
      )
    : 0;

  const revealCardBalance = React.useCallback(async (cardId: string) => {
    if (balancesUnlocked) {
      setBalanceFaceCardId(cardId);
      return;
    }
    if (authenticationInProgress.current) return;

    authenticationInProgress.current = true;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Biometrics unavailable',
          'Set up a fingerprint or other biometric on your device to view card balances.',
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify to view card balance',
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
      });
      if (!result.success) return;

      setBalancesUnlocked(true);
      setBalanceFaceCardId(cardId);
      if (!hasShownSwipeTip) {
        setHasShownSwipeTip(true);
        setSwipeTipVisible(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Could not verify', message);
    } finally {
      authenticationInProgress.current = false;
    }
  }, [balancesUnlocked, hasShownSwipeTip]);

  const saveNewCard = () => {
    const bank = newBankName.trim();
    const lastFour = newLastFour.trim();
    const balance = Number(newBalance);
    if (!bank || !/^\d{4}$/.test(lastFour) || !Number.isFinite(balance) || balance < 0) return;

    const cardCategory: WalletCategory = newCardType;
    const cardId = `custom-${Date.now()}`;
    addCard({
      id: cardId,
      bank: bank.toUpperCase(),
      displayName: `${bank} ${newCardType === 'credit' ? 'Credit' : 'Debit'}`,
      holder: 'CARDHOLDER',
      type: newCardType.toUpperCase(),
      category: cardCategory,
      number: `•••• ${lastFour}`,
      network: newNetwork,
      expiry: '08 / 32',
      currency: 'INR',
      lastUsedAt: Date.now(),
      colors: cardPalettes[newPaletteIndex],
      balance,
      monthlySpend: 0,
      ...(newCardType === 'credit' ? { creditLimit: 200000, outstanding: 0 } : {}),
      transactions: [],
    });
    setCategory(cardCategory);
    setSelectedId(cardId);
    setShowAllTransactions(false);
    setAddCardVisible(false);
    setNewBankName('');
    setNewLastFour('');
    setNewBalance('');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const index = cards.filter((card) => card.category === cardCategory).length;
        carouselRef.current?.scrollTo({ x: index * snapInterval, animated: true });
      });
    });
  };

  React.useEffect(() => {
    carouselRef.current?.scrollTo({ x: 0, animated: false });
  }, [category]);

  React.useEffect(() => {
    if (!focusCardId) return;
    const focusedCard = cards.find((card) => card.id === focusCardId);
    if (!focusedCard) return;

    const nextCategory = focusedCard.category;
    const cardIndex = cards
      .filter((card) => card.category === nextCategory)
      .findIndex((card) => card.id === focusedCard.id);
    setCategory(nextCategory);
    setSelectedId(focusedCard.id);
    setShowAllTransactions(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        carouselRef.current?.scrollTo({
          x: Math.max(0, cardIndex) * snapInterval,
          animated: true,
        });
      });
    });
  }, [focusCardId, snapInterval]);

  const selectCategory = (nextCategory: WalletCategory) => {
    const categoryIndex = categories.findIndex((item) => item.id === nextCategory);
    setCategory(nextCategory);
    setSelectedId(cards.find((card) => card.category === nextCategory)?.id ?? '');
    setBalanceFaceCardId(null);
    setShowAllTransactions(false);
    Animated.parallel([
      Animated.spring(rotation, {
        toValue: categoryIndex * 120,
        useNativeDriver: true,
        tension: 55,
        friction: 9,
      }),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1.18, duration: 120, useNativeDriver: true }),
        Animated.spring(glow, { toValue: 1, useNativeDriver: true, tension: 70, friction: 7 }),
      ]),
    ]).start();
    const nextCard = cards.find((card) => card.category === nextCategory);
    if (nextCard) markCardUsed(nextCard.id);
  };

  const onCarouselMomentumEnd = (event: {
    nativeEvent: { contentOffset: { x: number } };
  }) => {
    if (visibleCards.length === 0) return;
    const index = Math.max(
      0,
      Math.min(
        visibleCards.length - 1,
        Math.round(event.nativeEvent.contentOffset.x / snapInterval),
      ),
    );
    setSelectedId(visibleCards[index].id);
    markCardUsed(visibleCards[index].id);
    if (balancesUnlocked) setBalanceFaceCardId(visibleCards[index].id);
    setShowAllTransactions(false);
  };

  const renderCard = (card: WalletCardData, index: number) => {
    const selected = card.id === selectedId;
    const overlapsSelected = index === selectedIndex + 1;
    const center = index * snapInterval;
    const scale = scrollX.interpolate({
      inputRange: [center - snapInterval, center, center + snapInterval],
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });
    const rotate = scrollX.interpolate({
      inputRange: [center - snapInterval, center, center + snapInterval],
      outputRange: ['4deg', '0deg', '-4deg'],
      extrapolate: 'clamp',
    });

    return (
      <Pressable
        key={card.id}
        onPress={() => {
          setSelectedId(card.id);
          markCardUsed(card.id);
          void revealCardBalance(card.id);
          carouselRef.current?.scrollTo({ x: index * snapInterval, animated: true });
        }}
        style={{
          width: cardWidth,
          marginRight: -cardOverlap,
          zIndex: overlapsSelected ? 2 : selected ? 1 : 0,
          elevation: overlapsSelected ? 2 : selected ? 1 : 0,
        }}
      >
        <Animated.View
          style={{
            transform: [{ scale }, { rotateZ: rotate }],
          }}
        >
          <WalletCard
            card={card}
            index={index}
            selected={selected}
            showBalanceFace={card.id === balanceFaceCardId}
          />
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>MONARCH FINANCE</Text>
          <Text style={styles.title}>My Wallet</Text>
        </View>
        <Pressable
          style={styles.profileButton}
          accessibilityRole="button"
          accessibilityLabel="Add card"
          onPress={() => setAddCardVisible(true)}
        >
          <Feather name="plus" size={23} color="#F6F7FB" />
        </Pressable>
      </View>

      {selectedCard ? (
      <>
      <View style={styles.carouselHeading}>
        <Text style={styles.sectionEyebrow}>YOUR CARDS</Text>
        <Text style={styles.cardCount}>
          {String(selectedIndex + 1).padStart(2, '0')} / {String(visibleCards.length).padStart(2, '0')}
        </Text>
      </View>

      <Animated.ScrollView
        key={category}
        ref={carouselRef}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        bounces={false}
        contentContainerStyle={{ paddingHorizontal: insets }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onCarouselMomentumEnd}
        style={styles.carousel}
      >
        {visibleCards.map(renderCard)}
      </Animated.ScrollView>

      <View style={styles.pagination}>
        {visibleCards.map((card, index) => (
          <View
            key={card.id}
            style={[styles.paginationDot, index === selectedIndex && styles.paginationDotActive]}
          />
        ))}
      </View>

      <View style={styles.selectorSection}>
        <View style={styles.sectionTitleBlock}>
          <Text style={styles.sectionEyebrow}>EXPLORE</Text>
          <Text style={styles.selectorTitle}>Choose a card type</Text>
        </View>
        <View style={styles.selector}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.selectorRing,
              {
                transform: [
                  {
                    rotate: rotation.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}
          />
          <Animated.View style={[styles.selectorCore, { transform: [{ scale: glow }] }]}>
            <View style={styles.selectorGlow} />
            <Ionicons
              name={categories.find((item) => item.id === category)?.icon ?? 'card-outline'}
              size={24}
              color="#F5F7FF"
            />
            <Text style={styles.selectorCoreLabel}>{category.toUpperCase()}</Text>
          </Animated.View>
          {categories.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => selectCategory(item.id)}
              style={[
                styles.categoryOption,
                index === 0 && styles.categoryTop,
                index === 1 && styles.categoryBottomLeft,
                index === 2 && styles.categoryBottomRight,
                category === item.id && styles.categoryOptionActive,
              ]}
            >
              <Ionicons
                name={item.icon}
                size={17}
                color={category === item.id ? '#FFFFFF' : '#9DA6B8'}
              />
              <Text
                style={[
                  styles.categoryLabel,
                  category === item.id && styles.categoryLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.detailHeading}>
        <View>
          <Text style={styles.sectionEyebrow}>CARD OVERVIEW</Text>
            <Text style={styles.selectorTitle}>{selectedCard?.bank.toUpperCase()}</Text>
        </View>
        <View style={styles.cardTypeBadge}>
          <Text style={styles.cardTypeBadgeText}>{selectedCard.type}</Text>
        </View>
      </View>

      {selectedCard.creditLimit && (
        <View style={styles.balancePanel}>
          <View style={styles.balancePanelTop}>
            <View>
              <Text style={styles.mutedLabel}>AVAILABLE CREDIT</Text>
              <Text style={styles.balanceValue}>
                {balancesUnlocked
                  ? currency(creditAvailable ?? 0, selectedCard.currency ?? 'INR')
                  : '••••••'}
              </Text>
            </View>
            <View style={styles.outstandingBlock}>
              <Text style={styles.mutedLabel}>OUTSTANDING</Text>
              <Text style={styles.outstandingValue}>
                {balancesUnlocked
                  ? currency(selectedCard.outstanding ?? 0, selectedCard.currency ?? 'INR')
                  : '••••••'}
              </Text>
            </View>
          </View>
          <View style={styles.creditTrack}>
            <View
              style={[
                styles.creditFill,
                { width: `${Math.min((selectedCard.outstanding ?? 0) / selectedCard.creditLimit * 100, 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.creditFootnote}>
            Credit limit {currency(selectedCard.creditLimit, selectedCard.currency ?? 'INR')}
          </Text>
        </View>
      )}

      <View style={styles.balancePanel}>
        <View style={styles.balancePanelTop}>
          <View>
            <Text style={styles.mutedLabel}>
              {selectedCard.creditLimit ? 'CARD BALANCE' : category === 'transit' ? 'TRANSIT BALANCE' : 'AVAILABLE BALANCE'}
            </Text>
            <Text style={styles.balanceValue}>
              {balancesUnlocked
                ? currency(
                    selectedCard.creditLimit ? creditAvailable ?? 0 : selectedCard.balance,
                    selectedCard.currency ?? 'INR',
                  )
                : '••••••'}
            </Text>
          </View>
          <View style={styles.balanceIcon}>
            <Feather name="trending-up" size={19} color="#67E2B1" />
          </View>
        </View>
        <View style={styles.spendingRow}>
          <Text style={styles.mutedLabel}>MONTHLY SPENDING</Text>
          <Text style={styles.spendingAmount}>
            {balancesUnlocked
              ? currency(selectedCard.monthlySpend, selectedCard.currency ?? 'INR')
              : '••••••'}
          </Text>
        </View>
        <View style={styles.creditTrack}>
          <View style={[styles.spendingFill, { width: `${Math.max(spendingProgress * 100, 4)}%` }]} />
        </View>
      </View>

      <View style={styles.transactionsHeader}>
        <View>
          <Text style={styles.sectionEyebrow}>ACTIVITY</Text>
          <Text style={styles.selectorTitle}>Recent transactions</Text>
        </View>
        <Pressable onPress={() => setShowAllTransactions((current) => !current)}>
          <Text style={styles.viewAll}>
            {showAllTransactions ? 'Show less' : 'View all'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.transactionsList}>
        {selectedTransactions.slice(0, maxTransactions).map((transaction) => (
          <View key={transaction.id} style={styles.transactionRow}>
            <View style={styles.transactionIcon}>
              <Ionicons name={transaction.icon} size={19} color="#DCE2EF" />
            </View>
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionName}>{transaction.merchant}</Text>
              <Text style={styles.transactionDate}>{transaction.detail}</Text>
            </View>
            <Text style={[styles.transactionAmount, transaction.positive && styles.positiveAmount]}>
              {transaction.positive ? '+' : '−'}{currency(transaction.amount)}
            </Text>
          </View>
        ))}
      </View>
      </>
      ) : (
        <View style={styles.emptyWallet}>
          <Text style={styles.emptyWalletText}>Add a bank card to get started.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAddCardVisible(true)}
            style={styles.addFirstCardButton}
          >
            <Feather name="plus" size={17} color="#FFFFFF" />
            <Text style={styles.addFirstCardText}>Add your first card</Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={swipeTipVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSwipeTipVisible(false)}
      >
        <View style={styles.tipOverlay}>
          <View style={styles.swipeTipCard}>
            <LinearGradient
              colors={['#213B50', '#142334']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.tipIcon}>
              <Feather name="check" size={22} color="#A8F0D2" />
            </View>
            <Text style={styles.tipEyebrow}>VERIFIED SECURELY</Text>
            <Text style={styles.tipTitle}>Your balances are unlocked</Text>
            <Text style={styles.tipMessage}>
              Swipe one card at a time to bring it forward and reveal its balance.
            </Text>
            <View style={styles.tipSwipeHint}>
              <Feather name="arrow-left" size={16} color="#A8F0D2" />
              <Text style={styles.tipSwipeHintText}>SWIPE TO EXPLORE</Text>
              <Feather name="arrow-right" size={16} color="#A8F0D2" />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSwipeTipVisible(false)}
              style={styles.tipButton}
            >
              <Text style={styles.tipButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={addCardVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddCardVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addCardModal}>
            <View style={styles.modalHeading}>
              <View>
                <Text style={styles.modalEyebrow}>WALLET</Text>
                <Text style={styles.modalTitle}>Add a card</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close add card"
                onPress={() => setAddCardVisible(false)}
                style={styles.modalClose}
              >
                <Feather name="x" size={20} color="#E5EAF3" />
              </Pressable>
            </View>

            <Text style={styles.formLabel}>BANK NAME</Text>
            <TextInput
              value={newBankName}
              onChangeText={(value) => setNewBankName(value.toUpperCase())}
              placeholder="e.g. HDFC Bank"
              placeholderTextColor="#68758B"
              autoCapitalize="characters"
              style={styles.formInput}
              accessibilityLabel="Bank name"
            />

            <Text style={styles.formLabel}>LAST FOUR DIGITS</Text>
            <TextInput
              value={newLastFour}
              onChangeText={(value) => setNewLastFour(value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              placeholderTextColor="#68758B"
              keyboardType="number-pad"
              maxLength={4}
              style={styles.formInput}
              accessibilityLabel="Last four card digits"
            />

            <Text style={styles.formLabel}>BALANCE (INR)</Text>
            <TextInput
              value={newBalance}
              onChangeText={(value) => setNewBalance(value.replace(/[^\d.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor="#68758B"
              keyboardType="decimal-pad"
              style={styles.formInput}
              accessibilityLabel="Card balance in INR"
            />

            <Text style={styles.formLabel}>CARD TYPE</Text>
            <View style={styles.formOptions}>
              {(['debit', 'credit'] as const).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setNewCardType(type)}
                  style={[styles.formOption, newCardType === type && styles.formOptionActive]}
                >
                  <Text style={[styles.formOptionText, newCardType === type && styles.formOptionTextActive]}>
                    {type.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.formLabel}>NETWORK</Text>
            <View style={styles.formOptions}>
              {(['VISA', 'Mastercard', 'RuPay'] as const).map((network) => (
                <Pressable
                  key={network}
                  onPress={() => setNewNetwork(network)}
                  style={[styles.formOption, newNetwork === network && styles.formOptionActive]}
                >
                  <Text style={[styles.formOptionText, newNetwork === network && styles.formOptionTextActive]}>
                    {network}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.formLabel}>CARD COLOR</Text>
            <View style={styles.paletteRow}>
              {cardPalettes.map((palette, index) => (
                <Pressable
                  key={palette[0]}
                  accessibilityRole="button"
                  accessibilityLabel={`Select card color ${index + 1}`}
                  onPress={() => setNewPaletteIndex(index)}
                  style={[
                    styles.paletteSwatch,
                    newPaletteIndex === index && styles.paletteSwatchSelected,
                  ]}
                >
                  <LinearGradient
                    colors={palette}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.paletteFill}
                  />
                </Pressable>
              ))}
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={
                !newBankName.trim() ||
                newLastFour.length !== 4 ||
                !newBalance.trim() ||
                !Number.isFinite(Number(newBalance))
              }
              onPress={saveNewCard}
              style={[
                styles.saveCardButton,
                (
                  !newBankName.trim() ||
                  newLastFour.length !== 4 ||
                  !newBalance.trim() ||
                  !Number.isFinite(Number(newBalance))
                ) && styles.saveCardButtonDisabled,
              ]}
            >
              <Text style={styles.saveCardText}>Add card</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emptyWallet: {
    flex: 1,
    backgroundColor: '#080B12',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  emptyWalletText: {
    color: '#AAB4C5',
    fontSize: 14,
    marginTop: 10,
  },
  addFirstCardButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    backgroundColor: '#25405A',
    borderWidth: 1,
    borderColor: '#426687',
  },
  addFirstCardText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  tipOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(3,7,13,0.76)',
  },
  swipeTipCard: {
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingTop: 27,
    paddingBottom: 22,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(160,207,236,0.22)',
  },
  tipIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(104,218,180,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(138,235,201,0.3)',
    marginBottom: 16,
  },
  tipEyebrow: {
    color: '#91DCC4',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  tipTitle: {
    color: '#F5F7FB',
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 9,
  },
  tipMessage: {
    color: '#AAB8C9',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  tipSwipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(143,205,225,0.09)',
    marginTop: 20,
  },
  tipSwipeHintText: {
    color: '#B9D7E6',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  tipButton: {
    alignSelf: 'stretch',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#3978A3',
    marginTop: 21,
  },
  tipButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  addCardModal: {
    paddingTop: 24,
    paddingHorizontal: 22,
    paddingBottom: 34,
    backgroundColor: '#101722',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: '#273348',
  },
  modalHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalEyebrow: {
    color: '#8190A8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  modalTitle: {
    color: '#F6F7FB',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 4,
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1C2635',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formLabel: {
    color: '#8290A6',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 12,
    marginBottom: 8,
  },
  formInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A374A',
    backgroundColor: '#151E2B',
    paddingHorizontal: 14,
    color: '#F3F5FA',
    fontSize: 14,
  },
  formOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  formOption: {
    minHeight: 40,
    flex: 1,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A374A',
    backgroundColor: '#151E2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formOptionActive: {
    borderColor: '#6A9FC4',
    backgroundColor: '#25405A',
  },
  formOptionText: {
    color: '#AAB4C5',
    fontSize: 11,
    fontWeight: '600',
  },
  formOptionTextActive: {
    color: '#FFFFFF',
  },
  paletteRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  paletteSwatch: {
    width: 43,
    height: 43,
    borderRadius: 15,
    padding: 3,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paletteSwatchSelected: {
    borderColor: '#DCEBFA',
  },
  paletteFill: {
    flex: 1,
    borderRadius: 10,
  },
  saveCardButton: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: '#3978A3',
    marginTop: 24,
  },
  saveCardButtonDisabled: {
    opacity: 0.4,
  },
  saveCardText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  screen: {
    flex: 1,
    backgroundColor: '#080B12',
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 146,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 26,
  },
  eyebrow: {
    color: '#667187',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: '#F6F7FB',
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#151B27',
    borderWidth: 1,
    borderColor: '#242C3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: '#748096',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.7,
  },
  cardCount: {
    color: '#828DA1',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  carousel: {
    overflow: 'visible',
  },
  bankCard: {
    height: 196,
    borderRadius: 24,
    padding: 21,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 10,
  },
  cardFace: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  cardFaceContent: {
    flex: 1,
    padding: 21,
    justifyContent: 'space-between',
  },
  cardBackFace: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  balanceFaceContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  balanceFaceLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  balanceFaceCaption: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.6,
    marginTop: 16,
  },
  balanceFaceValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginTop: 5,
  },
  balanceFaceNumber: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.5,
    marginTop: 18,
  },
  cardLight: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -72,
    top: -90,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  bankName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  cardType: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.7,
    marginTop: 5,
  },
  chip: {
    width: 38,
    height: 29,
    borderRadius: 7,
    borderColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    backgroundColor: 'rgba(238,212,159,0.72)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipLineVertical: {
    position: 'absolute',
    height: '100%',
    width: 1,
    backgroundColor: 'rgba(78,66,48,0.45)',
  },
  chipLineHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(78,66,48,0.45)',
  },
  cardNumber: {
    color: 'rgba(255,255,255,0.94)',
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: 2.1,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardHolder: {
    color: 'rgba(255,255,255,0.83)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  cardNetwork: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 18,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: -0.8,
  },
  mastercardMark: {
    flexDirection: 'row',
    width: 42,
    height: 25,
    alignItems: 'center',
  },
  mastercardCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  mastercardRed: {
    backgroundColor: '#EB4548',
  },
  mastercardGold: {
    backgroundColor: 'rgba(255,179,62,0.92)',
    marginLeft: -7,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 20,
    marginTop: 8,
  },
  paginationDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#343D4C',
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: '#A8B4CA',
  },
  selectorSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  sectionTitleBlock: {
    alignSelf: 'stretch',
    marginHorizontal: 24,
    marginBottom: 10,
  },
  selectorTitle: {
    color: '#F1F3F8',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.25,
    marginTop: 5,
  },
  selector: {
    width: 224,
    height: 224,
    borderRadius: 112,
    backgroundColor: '#0E131E',
    borderWidth: 1,
    borderColor: '#1E2837',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: '#263146',
    borderStyle: 'dashed',
  },
  selectorCore: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#1A2639',
    borderWidth: 1,
    borderColor: '#385071',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  selectorGlow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(74,157,221,0.28)',
  },
  selectorCoreLabel: {
    color: '#C4D5EA',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 5,
  },
  categoryOption: {
    position: 'absolute',
    minWidth: 82,
    height: 42,
    borderRadius: 22,
    backgroundColor: '#151C29',
    borderWidth: 1,
    borderColor: '#283345',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  categoryTop: {
    top: 8,
    alignSelf: 'center',
  },
  categoryBottomLeft: {
    bottom: 20,
    left: 3,
  },
  categoryBottomRight: {
    bottom: 20,
    right: 3,
  },
  categoryOptionActive: {
    backgroundColor: '#25405A',
    borderColor: '#5D9CCC',
    shadowColor: '#4AA8E8',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  categoryLabel: {
    color: '#AAB4C5',
    fontSize: 10,
    fontWeight: '600',
  },
  categoryLabelActive: {
    color: '#FFFFFF',
  },
  detailHeading: {
    marginTop: 24,
    marginHorizontal: 24,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTypeBadge: {
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#172434',
  },
  cardTypeBadgeText: {
    color: '#87C6E9',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  balancePanel: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 18,
    backgroundColor: '#111722',
    borderWidth: 1,
    borderColor: '#1E2735',
    borderRadius: 20,
  },
  balancePanelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mutedLabel: {
    color: '#758198',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  balanceValue: {
    color: '#F5F7FB',
    fontSize: 23,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginTop: 5,
  },
  outstandingBlock: {
    alignItems: 'flex-end',
  },
  outstandingValue: {
    color: '#E9B97B',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
  },
  creditTrack: {
    height: 5,
    backgroundColor: '#263040',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 16,
  },
  creditFill: {
    height: '100%',
    backgroundColor: '#D9A56D',
    borderRadius: 3,
  },
  creditFootnote: {
    color: '#7F8A9E',
    fontSize: 10,
    marginTop: 8,
  },
  balanceIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#162B2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  spendingAmount: {
    color: '#D6DCEA',
    fontSize: 12,
    fontWeight: '600',
  },
  spendingFill: {
    height: '100%',
    backgroundColor: '#5DCBA3',
    borderRadius: 3,
  },
  transactionsHeader: {
    marginTop: 18,
    marginHorizontal: 24,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  viewAll: {
    color: '#75B9DE',
    fontSize: 12,
    fontWeight: '600',
    paddingBottom: 2,
  },
  transactionsList: {
    marginHorizontal: 20,
  },
  transactionRow: {
    minHeight: 69,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1B2330',
  },
  transactionIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: '#171E2A',
    borderWidth: 1,
    borderColor: '#252F3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionName: {
    color: '#E9EDF5',
    fontSize: 13,
    fontWeight: '500',
  },
  transactionDate: {
    color: '#788398',
    fontSize: 10,
    marginTop: 4,
  },
  transactionAmount: {
    color: '#F1F3F7',
    fontSize: 12,
    fontWeight: '600',
  },
  positiveAmount: {
    color: '#66D2A8',
  },
});
