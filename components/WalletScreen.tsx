import React from 'react';
import {
  Animated,
  Alert,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewInstance,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import {
  getWalletCardDisplayName,
  getWalletCardTypeLabel,
  WalletCard as WalletCardData,
  WalletCategory,
  WalletTransaction,
} from '../data/walletCards';
import {
  sortTransactionsByTimestamp,
  type Transaction,
} from '../data/transactions';
import {
  formatWalletCurrency,
  useWalletCards,
} from '../context/WalletCardsContext';
import {
  categoryFor,
  getTransactionMode,
} from '../utils/transactionCategories';
import type { CardDraft } from '../utils/cardValidation';
import CardDisintegrate from './wallet/CardDisintegrate';
import AddCashExpenseSheet, { cashExpenseCategories } from './wallet/AddCashExpenseSheet';
import AddCardSheet from './wallet/AddCardSheet';
import ManageCardsSheet from './wallet/ManageCardsSheet';
import PlusMenu from './wallet/PlusMenu';
import SpendingHistoryScreen from './wallet/SpendingHistoryScreen';
import WalletBackground from './wallet/WalletBackground';
import SpendingOverview from './spending/SpendingOverview';

const currency = (amount: number, currencyCode = 'INR') =>
  formatWalletCurrency(amount, currencyCode);

const CARD_HEIGHT = 196;
const CAROUSEL_BOTTOM_PADDING = 8;
const CAROUSEL_HEIGHT = CARD_HEIGHT + CAROUSEL_BOTTOM_PADDING;

function transactionDetail(date: Date) {
  const now = new Date();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayLabel =
    day === today
      ? 'Today'
      : day === today - 24 * 60 * 60 * 1000
        ? 'Yesterday'
        : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${dayLabel} · ${date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function SwipeDeleteCard({
  children,
  cardId,
  cardName,
  deleteVisible,
  isDeleting,
  hidden,
  reducedMotionDelete,
  restoreToken,
  itemWidth,
  cardWidth,
  index,
  deletedIndex,
  lastCardDelete,
  closeGap,
  onSwipeUp,
  onSwipeDown,
  onDelete,
  registerCardRef,
}: {
  children: React.ReactNode;
  cardId: string;
  cardName: string;
  deleteVisible: boolean;
  isDeleting: boolean;
  hidden: boolean;
  reducedMotionDelete: boolean;
  restoreToken: number;
  itemWidth: number;
  cardWidth: number;
  index: number;
  deletedIndex: number;
  lastCardDelete: boolean;
  closeGap: Animated.Value;
  onSwipeUp: (cardId: string) => void;
  onSwipeDown: (cardId: string) => void;
  onDelete: (cardId: string, cardName: string) => void;
  registerCardRef: (cardId: string, node: ViewInstance | null) => void;
}) {
  const deleteReveal = React.useRef(new Animated.Value(deleteVisible ? 1 : 0)).current;
  const restoreProgress = React.useRef(new Animated.Value(1)).current;
  const wrapperOpacity = React.useRef(new Animated.Value(1)).current;

  React.useLayoutEffect(() => {
    if (isDeleting) {
      deleteReveal.stopAnimation();
      deleteReveal.setValue(0);
    }
  }, [deleteReveal, isDeleting]);

  React.useEffect(() => {
    if (isDeleting) return;
    Animated.spring(deleteReveal, {
      toValue: deleteVisible ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
    }).start();
  }, [deleteReveal, deleteVisible, isDeleting]);

  React.useLayoutEffect(() => {
    if (hidden) {
      wrapperOpacity.stopAnimation();
      wrapperOpacity.setValue(0);
    }
  }, [hidden, wrapperOpacity]);

  React.useLayoutEffect(() => {
    if (restoreToken === 0) return;
    wrapperOpacity.stopAnimation();
    wrapperOpacity.setValue(0);
    restoreProgress.setValue(0);
    Animated.parallel([
      Animated.timing(wrapperOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(restoreProgress, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [restoreProgress, restoreToken, wrapperOpacity]);

  React.useEffect(() => {
    if (!isDeleting || !reducedMotionDelete) return;
    Animated.timing(wrapperOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isDeleting, reducedMotionDelete, wrapperOpacity]);

  React.useEffect(() => {
    if (!__DEV__ || !isDeleting || !hidden) return;
    const listener = wrapperOpacity.addListener(({ value }) => {
      if (value > 0.001) {
        console.warn(`Wallet delete wrapper for "${cardId}" became visible during its burst.`);
      }
    });
    return () => wrapperOpacity.removeListener(listener);
  }, [cardId, hidden, isDeleting, wrapperOpacity]);

  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => {
          if (isDeleting) return false;
          const isHorizontalReset =
            deleteVisible &&
            Math.abs(gesture.dx) > 8 &&
            Math.abs(gesture.dx) > Math.abs(gesture.dy);
          const isDownwardReset = deleteVisible && gesture.dy > 6;
          const isUpwardReveal =
            !deleteVisible &&
            gesture.dy < -8 &&
            Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.2;
          return isHorizontalReset || isDownwardReset || isUpwardReveal;
        },
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          !isDeleting &&
          deleteVisible &&
          ((Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) ||
            gesture.dy > 6),
        onPanResponderTerminationRequest: () => !deleteVisible || isDeleting,
        onPanResponderRelease: (_event, gesture) => {
          if (
            deleteVisible &&
            ((Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy)) ||
              gesture.dy > 10)
          ) {
            onSwipeDown(cardId);
          } else if (gesture.dy < -14) {
            onSwipeUp(cardId);
          }
        },
      }),
    [cardId, deleteVisible, isDeleting, onSwipeDown, onSwipeUp],
  );

  return (
    <Animated.View
      {...responder.panHandlers}
      pointerEvents={hidden ? 'none' : 'auto'}
      style={[
        styles.swipeDeleteItem,
        {
          width: itemWidth,
          height: CAROUSEL_HEIGHT,
          opacity: wrapperOpacity,
          transform: [
            {
              scale: restoreProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Animated.View
        ref={(node) => registerCardRef(cardId, node)}
        pointerEvents={isDeleting ? 'none' : 'auto'}
        style={{
          width: cardWidth,
          opacity: 1,
          transform: [
            {
              translateX:
                deletedIndex >= 0 && index > deletedIndex
                  ? closeGap.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -itemWidth],
                    })
                  : lastCardDelete && index === deletedIndex - 1
                    ? closeGap.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, itemWidth],
                      })
                  : 0,
            },
            {
              translateY: deleteReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -18],
              }),
            },
          ],
        }}
      >
        {children}
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.deleteWhiteOverlay,
          {
            width: cardWidth,
            opacity: deleteReveal.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.58],
            }),
            transform: [
              {
                translateY: deleteReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -18],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        pointerEvents={deleteVisible ? 'auto' : 'none'}
        style={[
          styles.deleteAction,
          { left: (cardWidth - 44) / 2 },
          {
            opacity: deleteReveal,
            transform: [
              {
                translateY: deleteReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, -18],
                }),
              },
              {
                scale: deleteReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.deleteActionGlow,
            {
              opacity: deleteReveal.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.9],
              }),
              transform: [
                {
                  scale: deleteReveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.65, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.deleteActionGlowInner} />
          <View style={styles.deleteActionGlowCore} />
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${cardName}`}
          disabled={isDeleting}
          onPress={() => onDelete(cardId, cardName)}
          style={styles.deleteActionButton}
        >
          <Feather name="trash-2" size={19} color="#FFFFFF" />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

function WalletCard({
  card,
  index,
  selected,
  showBalanceFace,
  newlyAdded = false,
  preview = false,
  reducedMotion = false,
}: {
  card: WalletCardData;
  index: number;
  selected: boolean;
  showBalanceFace: boolean;
  newlyAdded?: boolean;
  preview?: boolean;
  reducedMotion?: boolean;
}) {
  const entrance = React.useRef(new Animated.Value(0)).current;
  const flip = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (newlyAdded) {
      entrance.setValue(0);
      Animated.timing(entrance, {
        toValue: 1,
        duration: reducedMotion ? 180 : 350,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.spring(entrance, {
      toValue: 1,
      delay: index * 90,
      useNativeDriver: true,
      tension: 55,
      friction: 9,
    }).start();
  }, [entrance, newlyAdded, reducedMotion]);

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
    <Text style={styles.cardNetwork}>{card.network || 'WALLET'}</Text>
  );
  const cardNumber = card.number.trim() || 'CASH WALLET';

  return (
    <Animated.View
      style={[
        styles.bankCard,
        selected && {
          shadowColor: '#000000',
          shadowOpacity: 0.35,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: 14 },
          elevation: 14,
          borderColor: `${card.colors[0]}80`,
        },
        {
          opacity: newlyAdded
            ? entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] })
            : 1,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [22, 0],
              }),
            },
            {
              scale: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [newlyAdded && !reducedMotion ? 0.92 : 0.96, 1],
              }),
            },
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
              <Text style={[styles.bankName, preview && card.bank === 'BANK NAME' && styles.previewPlaceholder]}>
                {getWalletCardDisplayName(card)}
              </Text>
              <Text style={styles.cardType}>{getWalletCardTypeLabel(card)}</Text>
            </View>
            <Feather name="wifi" size={22} color="rgba(255,255,255,0.78)" />
          </View>
          <View style={styles.chip}>
            <View style={styles.chipLineVertical} />
            <View style={styles.chipLineHorizontal} />
          </View>
          <Text style={[styles.cardNumber, preview && card.number === '•••• 0000' && styles.previewPlaceholder]}>
            {cardNumber}
          </Text>
          <View style={styles.cardBottom}>
            <Text style={[styles.cardHolder, preview && card.holder === 'CARD HOLDER' && styles.previewPlaceholder]}>
              {card.holder || 'CASH ACCOUNT'}
            </Text>
            {brand}
          </View>
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
          <Text style={styles.balanceFaceLabel}>{getWalletCardDisplayName(card)}</Text>
          <Text style={styles.balanceFaceCaption}>AVAILABLE BALANCE</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.balanceFaceValue}>
            {currency(card.balance, card.currency ?? 'INR')}
          </Text>
          <Text style={styles.balanceFaceNumber}>{cardNumber}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

type WalletScreenProps = {
  focusCardId?: string;
  openAddCardRequest?: number;
  onOpenActivity?: (cardId: string) => void;
  onOpenTransaction?: (transactionId: string) => void;
};

export default function WalletScreen({
  focusCardId,
  openAddCardRequest = 0,
  onOpenActivity,
  onOpenTransaction,
}: WalletScreenProps) {
  const {
    cards,
    transactions: globalTransactions,
    isLoading,
    addCard,
    addTransaction,
    removeCard,
    updateCard,
    reorderCards,
    setDefaultCard,
    markCardUsed,
  } = useWalletCards();
  const { width } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const cardWidth = Math.min(width * 0.82, 340);
  const cardOverlap = 42;
  const snapInterval = cardWidth - cardOverlap;
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const carouselRef = React.useRef<React.ComponentRef<typeof Animated.ScrollView>>(null);
  const transactionsScrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const transactionsScrollY = useSharedValue(0);
  const backgroundScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      transactionsScrollY.value = event.contentOffset.y;
    },
  });
  const overlayRootRef = React.useRef<ViewInstance | null>(null);
  const plusButtonRef = React.useRef<ViewInstance>(null);
  const cardRefs = React.useRef(new Map<string, ViewInstance>());
  const closeGap = React.useRef(new Animated.Value(0)).current;
  const [category, setCategory] = React.useState<WalletCategory>('debit');
  const [selectedId, setSelectedId] = React.useState(() => cards[0]?.id ?? 'hdfc-debit');
  const initializedFirstCard = React.useRef(false);
  const [deleteActionCardId, setDeleteActionCardId] = React.useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = React.useState<string | null>(null);
  const [hiddenCardId, setHiddenCardId] = React.useState<string | null>(null);
  const [reducedMotionCardId, setReducedMotionCardId] = React.useState<string | null>(null);
  const [restoreCardId, setRestoreCardId] = React.useState<string | null>(null);
  const [restoreToken, setRestoreToken] = React.useState(0);
  const deleteConfirmed = React.useRef(false);
  const [balanceFaceCardId, setBalanceFaceCardId] = React.useState<string | null>(null);
  const [balancesUnlocked, setBalancesUnlocked] = React.useState(false);
  const [hasShownSwipeTip, setHasShownSwipeTip] = React.useState(false);
  const [swipeTipVisible, setSwipeTipVisible] = React.useState(false);
  const authenticationInProgress = React.useRef(false);
  const [addCardVisible, setAddCardVisible] = React.useState(false);
  const [manageCardsVisible, setManageCardsVisible] = React.useState(false);
  const [editingCard, setEditingCard] = React.useState<WalletCardData | null>(null);
  const [plusMenuVisible, setPlusMenuVisible] = React.useState(false);
  const [plusMenuAnchor, setPlusMenuAnchor] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [newlyAddedCardId, setNewlyAddedCardId] = React.useState<string | null>(null);
  const [cardAddedToast, setCardAddedToast] = React.useState(false);
  const [formInstance, setFormInstance] = React.useState(0);
  const plusScale = useSharedValue(1);
  const plusOpacity = useSharedValue(1);
  const plusButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: plusScale.value }],
    opacity: plusOpacity.value,
  }));
  const reducedMotion = useReducedMotion();
  const toastTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addCashExpenseVisible, setAddCashExpenseVisible] = React.useState(false);
  const [spendingHistoryVisible, setSpendingHistoryVisible] = React.useState(false);

  const visibleCards = cards;
  const selectedCard =
    visibleCards.find((card) => card.id === selectedId) ?? visibleCards[0];
  const selectedIndex = selectedCard
    ? visibleCards.findIndex((card) => card.id === selectedCard.id)
    : 0;
  const currentCardCounter = `${String(selectedIndex + 1).padStart(2, '0')} / ${String(visibleCards.length).padStart(2, '0')}`;
  const [displayedCardCounter, setDisplayedCardCounter] = React.useState(currentCardCounter);
  const cardCounterOpacity = React.useRef(new Animated.Value(1)).current;
  const insets = (width - cardWidth) / 2;
  const selectedTransactions = selectedCard?.transactions ?? [];
  const deletingCard = cards.find((card) => card.id === deletingCardId);
  const deletingIndex = deletingCardId
    ? cards.findIndex((card) => card.id === deletingCardId)
    : -1;
  const transactionGroups = React.useMemo(() => {
    if (!selectedCard) return [];
    const transactions = sortTransactionsByTimestamp(
      globalTransactions.filter((transaction) =>
        transaction.accountId === selectedCard.id ||
        (transaction.transferType === 'self' &&
          transaction.destinationAccountId === selectedCard.id),
      ),
    );
    if (!transactions.length) return [];
    return [{
      id: selectedCard.id,
      title: getWalletCardDisplayName(selectedCard),
      account: selectedCard,
      transactions,
    }];
  }, [globalTransactions, selectedCard]);
  const transactionListProgress = React.useRef(new Animated.Value(1)).current;
  const previousTransactionSource = React.useRef({
    cardId: selectedId,
    transactions: selectedTransactions,
  });

  const scrollToTransactions = React.useCallback(() => {
    setSpendingHistoryVisible(true);
  }, []);

  React.useEffect(() => {
    if (isLoading || focusCardId || initializedFirstCard.current || visibleCards.length === 0) return;
    initializedFirstCard.current = true;
    const defaultCard = visibleCards.find((card) => card.isDefault) ?? visibleCards[0];
    const defaultCardIndex = visibleCards.findIndex((card) => card.id === defaultCard.id);
    setSelectedId(defaultCard.id);
    setCategory(defaultCard.category);
    requestAnimationFrame(() => {
      carouselRef.current?.scrollTo({
        x: Math.max(0, defaultCardIndex) * snapInterval,
        animated: false,
      });
    });
  }, [focusCardId, isLoading, snapInterval, visibleCards]);

  const openAddCard = React.useCallback((card: WalletCardData | null = null) => {
    setEditingCard(card);
    setFormInstance((current) => current + 1);
    setAddCardVisible(true);
  }, []);

  const openManageCards = React.useCallback(() => {
    setManageCardsVisible(true);
  }, []);

  React.useEffect(() => {
    if (openAddCardRequest > 0) openAddCard();
  }, [openAddCard, openAddCardRequest]);

  const measurePlusButton = React.useCallback(() => {
    if (isLoading) return;
    plusButtonRef.current?.measureInWindow((x, y, buttonWidth, buttonHeight) => {
      setPlusMenuAnchor({ x, y, width: buttonWidth, height: buttonHeight });
      setPlusMenuVisible(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
  }, [isLoading]);

  React.useEffect(() => () => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
  }, []);

  React.useEffect(() => {
    const previous = previousTransactionSource.current;
    if (previous.cardId === selectedId && previous.transactions === selectedTransactions) return;
    previousTransactionSource.current = {
      cardId: selectedId,
      transactions: selectedTransactions,
    };
    transactionListProgress.setValue(0);
    Animated.timing(transactionListProgress, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [selectedId, selectedTransactions, transactionListProgress]);

  React.useEffect(() => {
    if (displayedCardCounter === currentCardCounter) return;
    Animated.timing(cardCounterOpacity, {
      toValue: 0,
      duration: 75,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setDisplayedCardCounter(currentCardCounter);
      Animated.timing(cardCounterOpacity, {
        toValue: 1,
        duration: 75,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [cardCounterOpacity, currentCardCounter, displayedCardCounter]);

  React.useEffect(() => {
    if (!deletingCardId || deletingCard) return;
    closeGap.setValue(0);
    setDeleteActionCardId(null);
    setDeletingCardId(null);
    setHiddenCardId(null);
    setReducedMotionCardId(null);
    setRestoreCardId(null);
    deleteConfirmed.current = false;
  }, [cards, closeGap, deletingCard, deletingCardId]);

  const registerCardRef = React.useCallback((cardId: string, node: ViewInstance | null) => {
    if (node) cardRefs.current.set(cardId, node);
    else cardRefs.current.delete(cardId);
  }, []);

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

  const saveCardDraft = (
    draft: CardDraft,
    colors: readonly [string, string, string],
    originalCard: WalletCardData | null,
    onSaved: () => void,
  ) => {
    if (originalCard?.id === 'cash-wallet') {
      updateCard(originalCard.id, {
        bank: draft.bank.trim(),
        displayName: draft.bank.trim(),
        colors,
      });
      onSaved();
      return;
    }

    const bank = draft.bank.trim();
    const displayName = bank;
    const cardType = draft.type.toUpperCase();
    if (originalCard) {
      updateCard(originalCard.id, {
        bank: bank.toUpperCase(),
        displayName,
        holder: draft.holder.trim().toUpperCase(),
        type: cardType,
        category: draft.type,
        number: `•••• ${draft.accountNumber.slice(-4)}`,
        network: draft.network,
        colors,
        balance: draft.balance,
        ...(draft.type === 'credit'
          ? {
              creditLimit: originalCard.creditLimit ?? 200000,
              outstanding: originalCard.outstanding ?? 0,
            }
          : { creditLimit: undefined, outstanding: undefined }),
      });
      if (originalCard.id === selectedId) setCategory(draft.type);
      onSaved();
      return;
    }

    if (cards.filter((card) => card.id !== 'cash-wallet').length >= 10) {
      Alert.alert('Card limit reached', 'You can add up to 10 cards.');
      return;
    }
    const cardId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newCard: WalletCardData = {
      id: cardId,
      bank: bank.toUpperCase(),
      displayName,
      holder: draft.holder.trim().toUpperCase(),
      type: cardType,
      category: draft.type,
      number: `•••• ${draft.accountNumber.slice(-4)}`,
      network: draft.network,
      expiry: '08 / 32',
      currency: 'INR',
      lastUsedAt: Date.now(),
      colors,
      balance: draft.balance,
      monthlySpend: 0,
      ...(draft.type === 'credit' ? { creditLimit: 200000, outstanding: 0 } : {}),
      transactions: [],
    };
    addCard(newCard);
    setCategory(draft.type);
    setSelectedId(cardId);
    setNewlyAddedCardId(cardId);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        carouselRef.current?.scrollTo({ x: cards.length * snapInterval, animated: true });
      });
    });
    onSaved();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCardAddedToast(true);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setCardAddedToast(false), 2200);
  };

  const reorderCard = (card: WalletCardData, targetIndex: number) => {
    const from = cards.findIndex((item) => item.id === card.id);
    if (from < 0 || targetIndex < 0 || targetIndex >= cards.length || targetIndex === from) return;
    const ordered = [...cards];
    ordered.splice(from, 1);
    ordered.splice(targetIndex, 0, card);
    reorderCards(ordered);
    const selectedPosition = ordered.findIndex((item) => item.id === selectedId);
    carouselRef.current?.scrollTo({ x: Math.max(0, selectedPosition) * snapInterval, animated: true });
  };

  const deleteFromManage = (card: WalletCardData) => {
    setManageCardsVisible(false);
    const index = cards.findIndex((item) => item.id === card.id);
    setSelectedId(card.id);
    carouselRef.current?.scrollTo({ x: Math.max(0, index) * snapInterval, animated: true });
    setDeleteActionCardId(card.id);
    setTimeout(() => confirmDeleteCard(card.id, card.displayName || card.bank), 220);
  };

  const saveCashExpense = ({
    amount,
    category,
    note,
    date,
  }: {
    amount: number;
    category: string;
    note: string;
    date: Date;
  }) => {
    if (!selectedCard || !selectedId) return;
    const categoryInfo =
      cashExpenseCategories.find((item) => item.label === category) ??
      cashExpenseCategories[cashExpenseCategories.length - 1];
    const transaction: WalletTransaction = {
      id: `cash-${Date.now()}`,
      merchant: note || category,
      detail: transactionDetail(date),
      amount,
      icon: categoryInfo.icon,
      category,
    };
    addTransaction(selectedId, transaction);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  React.useEffect(() => {
    if (!focusCardId) return;
    const focusedCard = cards.find((card) => card.id === focusCardId);
    if (!focusedCard) return;

    const nextCategory = focusedCard.category;
    const cardIndex = cards.findIndex((card) => card.id === focusedCard.id);
    setCategory(nextCategory);
    setSelectedId(focusedCard.id);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        carouselRef.current?.scrollTo({
          x: Math.max(0, cardIndex) * snapInterval,
          animated: true,
        });
      });
    });
  }, [focusCardId, snapInterval]);

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
    setDeleteActionCardId(null);
    setSelectedId(visibleCards[index].id);
    setCategory(visibleCards[index].category);
    markCardUsed(visibleCards[index].id);
    if (balancesUnlocked) setBalanceFaceCardId(visibleCards[index].id);
  };

  const restoreFailedDelete = React.useCallback((cardId: string) => {
    const failedIndex = cards.findIndex((card) => card.id === cardId);
    closeGap.setValue(0);
    setHiddenCardId(null);
    setReducedMotionCardId(null);
    setDeletingCardId(null);
    setRestoreCardId(cardId);
    setRestoreToken((token) => token + 1);
    carouselRef.current?.scrollTo({
      x: Math.max(0, failedIndex) * snapInterval,
      animated: true,
    });
    Alert.alert("Couldn't delete card");
  }, [cards, closeGap, snapInterval]);

  const completeDeleteCard = React.useCallback((cardId: string) => {
    const deletedIndex = cards.findIndex((card) => card.id === cardId);
    const remainingCards = cards.filter((card) => card.id !== cardId);
    const nextCard = remainingCards[Math.min(deletedIndex, remainingCards.length - 1)];

    try {
      removeCard(cardId);
      setBalanceFaceCardId(null);
      setSelectedId(nextCard?.id ?? '');
    } catch {
      restoreFailedDelete(cardId);
    }
  }, [cards, closeGap, removeCard, restoreFailedDelete]);
  const setDisintegrationCardHidden = React.useCallback(
    (cardId: string, hidden: boolean) => {
      setHiddenCardId((current) =>
        hidden ? cardId : current === cardId ? null : current,
      );
    },
    [],
  );
  const setReducedMotionDelete = React.useCallback((cardId: string, enabled: boolean) => {
    setReducedMotionCardId((current) =>
      enabled ? cardId : current === cardId ? null : current,
    );
  }, []);
  const prepareCardSnapshot = React.useCallback((cardId: string) => {
    setDeleteActionCardId((current) => (current === cardId ? null : current));
  }, []);

  const confirmDeleteCard = React.useCallback((cardId: string, cardName: string) => {
    deleteConfirmed.current = false;
    Alert.alert(
      'Delete card?',
      `Are you sure you want to delete ${cardName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setDeleteActionCardId(null) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteConfirmed.current = true;
            setDeletingCardId(cardId);
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          if (deleteConfirmed.current) {
            deleteConfirmed.current = false;
            return;
          }
          setDeleteActionCardId(null);
        },
      },
    );
  }, []);

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
      <SwipeDeleteCard
        key={card.id}
        cardId={card.id}
        cardName={card.displayName || card.bank}
        deleteVisible={deleteActionCardId === card.id}
        isDeleting={deletingCardId === card.id}
        hidden={hiddenCardId === card.id}
        reducedMotionDelete={reducedMotionCardId === card.id}
        restoreToken={restoreCardId === card.id ? restoreToken : 0}
        itemWidth={snapInterval}
        cardWidth={cardWidth}
        index={index}
        deletedIndex={deletingIndex}
        lastCardDelete={deletingIndex === cards.length - 1}
        closeGap={closeGap}
        onSwipeUp={setDeleteActionCardId}
        onSwipeDown={(cardId) =>
          setDeleteActionCardId((current) => (current === cardId ? null : current))
        }
        onDelete={confirmDeleteCard}
        registerCardRef={registerCardRef}
      >
        <Pressable
          disabled={deleteActionCardId === card.id}
          onPress={() => {
            setDeleteActionCardId(null);
            setSelectedId(card.id);
            setCategory(card.category);
            markCardUsed(card.id);
            void revealCardBalance(card.id);
            carouselRef.current?.scrollTo({ x: index * snapInterval, animated: true });
          }}
          style={{
            width: cardWidth,
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
              newlyAdded={card.id === newlyAddedCardId}
              reducedMotion={reducedMotion}
            />
          </Animated.View>
        </Pressable>
      </SwipeDeleteCard>
    );
  };

  const renderPreviewCard = React.useCallback(
    (card: WalletCardData) => (
      <WalletCard
        card={card}
        index={0}
        selected={false}
        showBalanceFace={false}
        preview
        reducedMotion={reducedMotion}
      />
    ),
    [],
  );

  return (
    <GestureHandlerRootView style={styles.walletRoot}>
    <View ref={overlayRootRef} collapsable={false} style={styles.walletRoot}>
    <WalletBackground
      activeCardColor={selectedCard?.colors[0]}
      scrollY={transactionsScrollY}
    />
    <View
      style={[
        styles.screen,
        styles.scrollContent,
      ]}
    >
    <View style={[styles.header, { paddingTop: safeAreaInsets.top }]}>
      <Text style={styles.title}>My Wallet</Text>
        <Reanimated.View style={plusButtonStyle}>
          <Pressable
            ref={plusButtonRef}
            style={styles.profileButton}
            accessibilityRole="button"
            accessibilityLabel="Wallet actions"
            disabled={isLoading}
            hitSlop={10}
            onPress={measurePlusButton}
            onPressIn={() => {
              if (reducedMotion) {
                plusOpacity.value = withTiming(0.7, { duration: 90 });
              } else {
                plusScale.value = withTiming(0.92, { duration: 90 });
              }
            }}
            onPressOut={() => {
              if (reducedMotion) {
                plusOpacity.value = withTiming(1, { duration: 80 });
              } else {
                plusScale.value = withSpring(1, { damping: 16, stiffness: 220 });
              }
            }}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </Pressable>
        </Reanimated.View>
      </View>

      {selectedCard ? (
      <>
      <View style={styles.carouselHeading}>
        <Text style={[styles.sectionEyebrow, styles.heroEyebrow]}>BANK ACCOUNTS</Text>
        <Animated.Text style={[styles.cardCount, { opacity: cardCounterOpacity }]}>
          {displayedCardCounter}
        </Animated.Text>
      </View>

      <View style={[styles.carouselFrame, { height: CAROUSEL_HEIGHT }]}>
        <Animated.ScrollView
          ref={carouselRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={snapInterval}
          snapToAlignment="start"
          disableIntervalMomentum
          bounces={false}
          contentContainerStyle={{ paddingHorizontal: insets, alignItems: 'flex-start' }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => {
            if (deletingCardId === null) onCarouselMomentumEnd(event);
          }}
          scrollEnabled={deletingCardId === null}
          style={[styles.carousel, { height: CAROUSEL_HEIGHT }]}
        >
          {visibleCards.map(renderCard)}
        </Animated.ScrollView>
      </View>

      <View style={styles.pagination}>
        {visibleCards.map((card, index) => (
          <View
            key={card.id}
            style={[styles.paginationDot, index === selectedIndex && styles.paginationDotActive]}
          />
        ))}
      </View>

      <View style={styles.sheet}>
      <SpendingOverview
        cards={cards}
        selectedCardId={selectedId}
        masked={!balancesUnlocked}
        isLoading={isLoading}
        onViewAll={() => {
          if (onOpenActivity) onOpenActivity(selectedId);
          else scrollToTransactions();
        }}
      />

      <View
        style={styles.transactionsHeader}
      >
        <View>
          <Text style={styles.sectionEyebrow}>ACTIVITY</Text>
          <Text style={styles.selectorTitle}>Recent transactions</Text>
        </View>
      </View>

      <Animated.View
        style={[
          styles.transactionsList,
          {
            opacity: transactionListProgress,
            transform: [
              {
                translateY: transactionListProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Reanimated.ScrollView
          ref={transactionsScrollRef}
          style={styles.transactionsScroll}
          contentContainerStyle={[
            styles.transactionsScrollContent,
            { paddingBottom: safeAreaInsets.bottom + 120 },
          ]}
          bounces
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          onScroll={backgroundScrollHandler}
          scrollEventThrottle={16}
        >
          {!balancesUnlocked ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Verify with fingerprint to view recent transactions"
              onPress={() => {
                if (selectedCard) void revealCardBalance(selectedCard.id);
              }}
              style={styles.lockedTransactions}
            >
              <View style={styles.lockedTransactionsIcon}>
                <Ionicons name="finger-print-outline" size={23} color="#77777E" />
              </View>
              <Text style={styles.emptyTransactionsTitle}>Verify to view transactions</Text>
              <Text style={styles.lockedTransactionsHint}>Tap to unlock with fingerprint</Text>
            </Pressable>
          ) : (
            <>
              {transactionGroups.map((group) => (
                <View key={group.id} style={styles.accountTransactionGroup}>
                  <View style={styles.accountTransactionHeading}>
                    <View
                      style={[
                        styles.accountTransactionDot,
                        { backgroundColor: group.account?.colors[0] ?? '#92929A' },
                      ]}
                    />
                    <Text numberOfLines={1} style={styles.accountTransactionTitle}>
                      {group.title}
                    </Text>
                  </View>
                  {group.transactions.map((transaction) => {
                    const incomingTransfer =
                      transaction.transferType === 'self' &&
                      transaction.destinationAccountId === group.account?.id;
                    const mode = getTransactionMode(transaction);
                    const income = incomingTransfer || mode === 'income';
                    const category = categoryFor(mode, transaction.category ?? 'Other');
                    return (
                      <Pressable
                        key={transaction.id}
                        accessibilityRole="button"
                        accessibilityLabel={`Open transaction details for ${transaction.title}`}
                        disabled={!onOpenTransaction}
                        onPress={() => onOpenTransaction?.(transaction.id)}
                        style={styles.transactionRow}
                      >
                        <View style={styles.transactionIcon}>
                          <Ionicons name={category.icon} size={19} color="#6D6D73" />
                        </View>
                        <View style={styles.transactionInfo}>
                          <Text numberOfLines={1} style={styles.transactionName}>
                            {transaction.title}
                          </Text>
                          <Text style={styles.transactionDate}>{transaction.subtitle}</Text>
                        </View>
                        <Text style={[styles.transactionAmount, income && styles.positiveAmount]}>
                          {income ? '+' : '−'}{currency(transaction.amount)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              {transactionGroups.length === 0 ? (
                <View style={styles.emptyTransactions}>
                  <Text style={styles.emptyTransactionsTitle}>No transactions yet</Text>
                </View>
              ) : null}
            </>
          )}
        </Reanimated.ScrollView>
      </Animated.View>
      </View>
      </>
      ) : (
        <View style={styles.emptyWallet}>
          <Text style={styles.emptyWalletText}>Add a bank card to get started.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => openAddCard()}
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

      <PlusMenu
        visible={plusMenuVisible}
        anchor={plusMenuAnchor}
        onClose={() => setPlusMenuVisible(false)}
        onAddCard={() => openAddCard()}
        onManageCards={openManageCards}
      />
      <AddCardSheet
        key={`${editingCard?.id ?? 'new-card-form'}-${formInstance}`}
        visible={addCardVisible}
        cards={cards}
        card={editingCard}
        onClose={() => {
          setAddCardVisible(false);
          setEditingCard(null);
        }}
        onSave={saveCardDraft}
        renderPreview={renderPreviewCard}
      />
      <ManageCardsSheet
        visible={manageCardsVisible}
        cards={cards}
        masked={!balancesUnlocked}
        onClose={() => setManageCardsVisible(false)}
        onAddCard={() => {
          setManageCardsVisible(false);
          openAddCard();
        }}
        onEdit={(card) => {
          setManageCardsVisible(false);
          openAddCard(card);
        }}
        onSetDefault={(card) => {
          setDefaultCard(card.id);
        }}
        onDelete={deleteFromManage}
        onMove={reorderCard}
      />
      {cardAddedToast ? (
        <View pointerEvents="none" style={styles.toast}>
          <Feather name="check-circle" size={16} color="#FFFFFF" />
          <Text style={styles.toastText}>Card added</Text>
        </View>
      ) : null}
      <AddCashExpenseSheet
        visible={addCashExpenseVisible}
        accountName={selectedCard?.displayName || selectedCard?.bank || 'Wallet'}
        onClose={() => setAddCashExpenseVisible(false)}
        onSave={saveCashExpense}
      />
    </View>
    {spendingHistoryVisible && selectedCard ? (
      <SpendingHistoryScreen
        key={selectedCard.id}
        card={selectedCard}
        onBack={() => setSpendingHistoryVisible(false)}
      />
    ) : null}
    {deletingCard && deletingCardId ? (
      <CardDisintegrate
        active
        cardId={deletingCardId}
        colors={deletingCard.colors}
        card={cardRefs.current.get(deletingCardId) ?? null}
        overlayRootRef={overlayRootRef}
        closeGap={closeGap}
        onPrepareSnapshot={prepareCardSnapshot}
        onCardHidden={setDisintegrationCardHidden}
        onReducedMotionMode={setReducedMotionDelete}
        onMeasureFailure={restoreFailedDelete}
        onComplete={completeDeleteCard}
      />
    ) : null}
    </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  walletRoot: {
    flex: 1,
  },
  emptyWallet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  emptyWalletText: {
    color: '#6B6B6B',
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
    backgroundColor: '#E8420F',
    borderWidth: 1,
    borderColor: '#F5873F',
  },
  addFirstCardText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(50,30,20,0.42)',
  },
  tipOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(50,30,20,0.42)',
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
    borderColor: 'rgba(232,66,15,0.18)',
  },
  tipIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,66,15,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232,66,15,0.2)',
    marginBottom: 16,
  },
  tipEyebrow: {
    color: '#C63A13',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  tipTitle: {
    color: '#202124',
    fontSize: 21,
    fontWeight: '600',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 9,
  },
  tipMessage: {
    color: '#686868',
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
    backgroundColor: 'rgba(232,66,15,0.08)',
    marginTop: 20,
  },
  tipSwipeHintText: {
    color: '#8C351F',
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
    backgroundColor: '#E8420F',
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  modalHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalEyebrow: {
    color: '#8B8B90',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  modalTitle: {
    color: '#1C1C1E',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 4,
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flex: 1,
    minHeight: 0,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 33,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.7,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButtonContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 94,
    zIndex: 1100,
    elevation: 1100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    backgroundColor: '#222228',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  carouselHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  sectionEyebrow: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.7,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.7)',
  },
  cardCount: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    fontVariant: ['tabular-nums'],
  },
  carousel: {
    overflow: 'visible',
  },
  carouselFrame: {
    flexShrink: 0,
    overflow: 'visible',
  },
  swipeDeleteItem: {
    position: 'relative',
    overflow: 'visible',
  },
  deleteAction: {
    position: 'absolute',
    top: 76,
    zIndex: 20,
    elevation: 20,
  },
  deleteWhiteOverlay: {
    position: 'absolute',
    top: 0,
    height: 196,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    zIndex: 12,
    elevation: 12,
  },
  deleteActionGlow: {
    position: 'absolute',
    width: 104,
    height: 104,
    top: -30,
    left: -30,
    borderRadius: 52,
    backgroundColor: 'rgba(239,65,35,0.035)',
    shadowColor: '#F04A27',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.48,
    shadowRadius: 30,
    elevation: 10,
  },
  deleteActionGlowInner: {
    position: 'absolute',
    width: 78,
    height: 78,
    top: 13,
    left: 13,
    borderRadius: 39,
    backgroundColor: 'rgba(239,65,35,0.07)',
  },
  deleteActionGlowCore: {
    position: 'absolute',
    width: 54,
    height: 54,
    top: 25,
    left: 25,
    borderRadius: 27,
    backgroundColor: 'rgba(239,65,35,0.12)',
  },
  deleteActionButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#D93620',
    borderWidth: 3,
    borderColor: '#FFF8F4',
    shadowColor: '#F04A27',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75,
    shadowRadius: 16,
    elevation: 12,
  },
  bankCard: {
    height: CARD_HEIGHT,
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
  previewPlaceholder: {
    opacity: 0.5,
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
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: '#FFFFFF',
  },
  sheet: {
    flex: 1,
    minHeight: 0,
    marginTop: -28,
    paddingTop: 28,
    backgroundColor: '#FFF8F5',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  selectorTitle: {
    color: '#252525',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.25,
    marginTop: 5,
  },
  detailHeading: {
    marginTop: 21,
    marginHorizontal: 24,
    marginBottom: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF0E9',
    borderWidth: 1,
    borderColor: '#F6D4C5',
  },
  cardTypeBadgeText: {
    color: '#C63A13',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  balancePanel: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0E7E2',
    borderRadius: 22,
    shadowColor: '#7A2E0E',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  balancePanelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mutedLabel: {
    color: '#858585',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  balanceValueBlock: {
    flex: 1,
  },
  balanceValue: {
    color: '#1C1C1E',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.8,
    marginTop: 7,
  },
  outstandingBlock: {
    alignItems: 'flex-end',
  },
  outstandingValue: {
    color: '#C63A13',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
  },
  creditTrack: {
    height: 7,
    backgroundColor: '#F1EAE6',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 13,
  },
  creditFill: {
    height: '100%',
    backgroundColor: '#E8420F',
    borderRadius: 4,
  },
  creditFootnote: {
    color: '#858585',
    fontSize: 10,
    marginTop: 10,
  },
  creditFootnoteStrong: {
    color: '#555555',
    fontWeight: '700',
  },
  balanceIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: '#FFF0E9',
    borderWidth: 1,
    borderColor: '#F8DDCF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EEE7E3',
    marginTop: 17,
    marginBottom: 14,
  },
  spendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spendingAmount: {
    color: '#242424',
    fontSize: 14,
    fontWeight: '700',
  },
  spendingHint: {
    color: '#999999',
    fontSize: 10,
    marginTop: 4,
  },
  spendingFill: {
    height: '100%',
    backgroundColor: '#E8420F',
    borderRadius: 4,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressCaption: {
    color: '#A0A0A0',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  transactionsHeader: {
    flexShrink: 0,
    marginTop: 18,
    marginHorizontal: 24,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  viewAll: {
    color: '#D54517',
    fontSize: 12,
    fontWeight: '600',
    paddingBottom: 2,
  },
  transactionsList: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  transactionsScroll: {
    flex: 1,
  },
  transactionsScrollContent: {
    flexGrow: 1,
    minHeight: 207,
  },
  emptyTransactions: {
    minHeight: 207,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTransactionsTitle: {
    color: '#858585',
    fontSize: 13,
  },
  lockedTransactions: {
    flex: 1,
    minHeight: 207,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  lockedTransactionsIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
    borderRadius: 21,
    backgroundColor: '#F2F2F2',
  },
  lockedTransactionsHint: {
    color: '#A0A0A5',
    fontSize: 11,
  },
  accountTransactionGroup: {
    marginBottom: 10,
  },
  accountTransactionHeading: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAEAEA',
  },
  accountTransactionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  accountTransactionTitle: {
    flex: 1,
    color: '#77777E',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  transactionRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EAEAEA',
  },
  transactionIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: '#F2F2F2',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionName: {
    color: '#242424',
    fontSize: 13,
    fontWeight: '500',
  },
  transactionDate: {
    color: '#858585',
    fontSize: 10,
    marginTop: 4,
  },
  transactionAmount: {
    color: '#202124',
    fontSize: 12,
    fontWeight: '600',
  },
  positiveAmount: {
    color: '#27805F',
  },
});
