import React from 'react';
import {
  Alert,
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';

import {
  formatWalletCurrency,
  getTopCards,
} from '../context/WalletCardsContext';
import { getWalletCardTypeLabel, WalletCard } from '../data/walletCards';

const CARD_HEIGHT = 150;
const EXPANDED_GAP = 10;
const CARD_SIDE_INSET = 28;
const EXPANDED_SIDE_INSET = 37;

type CardStackProps = {
  cards: WalletCard[];
  isLoading?: boolean;
  onOpenWallet: (cardId?: string) => void;
  onExpansionHeightChange?: (height: number, reduceMotion: boolean) => void;
  onExpandedChange?: (expanded: boolean) => void;
  collapseRequest?: number;
};

function displayCardName(card: WalletCard) {
  if (card.number?.trim()) {
    return card.bank?.trim() || card.displayName?.trim() || card.holder?.trim() || 'Wallet card';
  }
  return card.displayName?.trim() || card.holder?.trim() || card.bank?.trim() || 'Wallet card';
}

function CardLayer({
  card,
  rank,
  count,
  width,
  expanded,
  reduceMotion,
  showBalance,
  onPress,
  onInteract,
}: {
  card: WalletCard;
  rank: number;
  count: number;
  width: number;
  expanded: boolean;
  reduceMotion: boolean;
  showBalance: boolean;
  onPress: () => void;
  onInteract: () => void;
}) {
  const transition = React.useRef(new Animated.Value(0)).current;
  const pressScale = React.useRef(new Animated.Value(1)).current;
  const flip = React.useRef(new Animated.Value(0)).current;
  const collapsedInset = CARD_SIDE_INSET + rank * 14;
  const collapsedTop = (count - rank - 1) * 14;
  const expandedTop = rank * (CARD_HEIGHT + EXPANDED_GAP);
  const cardColor = card.colors?.[0] ?? '#D56B37';
  const cardName = displayCardName(card);
  const cardNumber = card.number?.trim();
  const hasNumber = Boolean(cardNumber);
  const isCashWallet = !hasNumber;
  const network = card.network?.trim();
  const balance = formatWalletCurrency(card.balance, card.currency ?? 'INR');
  const monthlySpend = formatWalletCurrency(card.monthlySpend, card.currency ?? 'INR');

  React.useEffect(() => {
    flip.stopAnimation();
    Animated.spring(flip, {
      toValue: showBalance ? 1 : 0,
      useNativeDriver: true,
      damping: 16,
      stiffness: 150,
    }).start();
  }, [flip, showBalance]);
  const frontRotation = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotation = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['-180deg', '0deg'],
  });
  const flipScale = flip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.96, 1],
  });
  const flipLift = flip.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -4, 0],
  });

  React.useEffect(() => {
    transition.stopAnimation();
    if (reduceMotion) {
      transition.setValue(expanded ? 1 : 0);
      return;
    }

    const animation = Animated.spring(transition, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 160,
      mass: 1,
    });
    animation.start();
    return () => animation.stop();
  }, [expanded, reduceMotion, transition]);

  const cardWidth = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [1, (width - EXPANDED_SIDE_INSET * 2) / (width - collapsedInset * 2)],
  });
  const translateY = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, expandedTop - collapsedTop],
  });
  const scale = transition.interpolate({
    inputRange: [0, 1],
    outputRange: [rank === 0 ? 1 : rank === 1 ? 0.97 : 0.94, 1],
  });

  const handlePressIn = () => {
    if (expanded) onInteract();
    Animated.spring(pressScale, {
      toValue: 0.98,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.cardLayer,
        {
            width: width - collapsedInset * 2,
            left: collapsedInset,
            top: collapsedTop,
          opacity: 1,
          zIndex: count - rank,
          elevation: count - rank,
            transform: [
              { translateY },
              { scaleX: cardWidth },
              { scale },
              { scale: pressScale },
            ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? 'Open Wallet' : 'Expand cards'}, ${cardName}`}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardPressable}
      >
        <LinearGradient
          colors={[cardColor, card.colors?.[1] ?? cardColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardBorder} />

        <Animated.View
          style={[
            styles.cardFrontFace,
            {
              transform: [
                { perspective: 500 },
                { translateY: flipLift },
                { scale: flipScale },
                { rotateY: frontRotation },
              ],
            },
          ]}
        >
        {(expanded || rank === 0) ? (
          <View style={styles.cardContent}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardIdentity}>
                <Text numberOfLines={1} ellipsizeMode="tail" style={styles.cardName}>
                  {cardName}
                </Text>
                {!isCashWallet && (
                  <Text style={styles.cardType}>{getWalletCardTypeLabel(card)}</Text>
                )}
              </View>
              {hasNumber && (
                <View style={styles.networkMark}>
                  {network?.toLowerCase() === 'mastercard' ? (
                    <View style={styles.mastercardBrand}>
                      <View style={styles.mastercardMark}>
                        <View style={[styles.mastercardCircle, styles.mastercardRed]} />
                        <View style={[styles.mastercardCircle, styles.mastercardGold]} />
                      </View>
                      <Text style={styles.mastercardText}>Mastercard</Text>
                    </View>
                  ) : (
                    <Text numberOfLines={1} style={styles.cardNetwork}>
                      {network?.toLowerCase() === 'visa'
                        ? 'VISA'
                        : network?.toLowerCase() === 'rupay'
                          ? 'RuPay'
                          : network || card.type || 'CARD'}
                    </Text>
                  )}
                </View>
              )}
            </View>
            {hasNumber ? (
              <View style={styles.cardNumberBlock}>
                <View style={styles.chip}>
                  <View style={styles.chipLineVertical} />
                  <View style={styles.chipLineHorizontal} />
                </View>
                <Text numberOfLines={1} style={styles.cardNumber}>
                  {cardNumber}
                </Text>
              </View>
            ) : null}
            <View style={styles.cardBottomRow}>
              <View style={styles.cardFooterMeta}>
                <Text numberOfLines={1} style={styles.cardHolder}>
                  {hasNumber ? card.holder : 'CASH WALLET'}
                </Text>
                <View style={styles.monthlySpendWrap}>
                  <Text style={styles.monthlySpendLabel}>SPENT</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.monthlySpendValue}>
                    {monthlySpend}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.backCardName}>
            {cardName}
          </Text>
        )}
        </Animated.View>

        <Animated.View
          pointerEvents={showBalance ? 'auto' : 'none'}
          style={[
            styles.cardBalanceFace,
            {
              transform: [
                { perspective: 500 },
                { translateY: flipLift },
                { scale: flipScale },
                { rotateY: backRotation },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={[card.colors?.[1] ?? cardColor, card.colors?.[2] ?? cardColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text numberOfLines={1} style={styles.balanceFaceName}>{cardName}</Text>
          <Text style={styles.balanceFaceCaption}>ACCOUNT BALANCE</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.balanceFaceAmount}>
            {balance}
          </Text>
          {hasNumber && <Text style={styles.balanceFaceNumber}>{cardNumber}</Text>}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function CardSkeleton({ width }: { width: number }) {
  const shimmer = React.useRef(new Animated.Value(0.55)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  return (
    <>
      {[2, 1, 0].map((position) => (
        <Animated.View
          key={position}
          style={[
            styles.skeletonCard,
            {
              width: width - (CARD_SIDE_INSET + position * 16) * 2,
              left: CARD_SIDE_INSET + position * 16,
              top: 32 - position * 16,
              opacity: shimmer,
              zIndex: 3 - position,
            },
          ]}
        />
      ))}
    </>
  );
}

export default function CardStack({
  cards,
  isLoading = false,
  onOpenWallet,
  onExpansionHeightChange,
  onExpandedChange,
  collapseRequest = 0,
}: CardStackProps) {
  const { width: screenWidth } = useWindowDimensions();
  const stackWidth = screenWidth - 48;
  const topCards = React.useMemo(() => getTopCards(cards, 3), [cards]);
  const [expanded, setExpanded] = React.useState(false);
  const [balanceCardId, setBalanceCardId] = React.useState<string | null>(null);
  const [balancesUnlocked, setBalancesUnlocked] = React.useState(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const progress = React.useRef(new Animated.Value(0)).current;
  const pressScale = React.useRef(new Animated.Value(1)).current;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const authenticationInProgress = React.useRef(false);
  const cardsSignature = topCards.map((card) => card.id).join('|');

  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const clearTimer = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const collapse = React.useCallback(() => {
    clearTimer();
    setExpanded(false);
  }, [clearTimer]);

  const restartTimer = React.useCallback(() => {
    clearTimer();
    timer.current = setTimeout(collapse, 10000);
  }, [clearTimer, collapse]);

  React.useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  React.useEffect(() => {
    if (!expanded || topCards.length < 2 || isLoading) {
      clearTimer();
      return;
    }
    restartTimer();
    return clearTimer;
  }, [cardsSignature, clearTimer, expanded, isLoading, restartTimer, topCards.length]);

  React.useEffect(() => {
    if (expanded && (topCards.length < 2 || isLoading)) setExpanded(false);
  }, [expanded, isLoading, topCards.length]);

  const expandedStackHeight =
    topCards.length * CARD_HEIGHT + Math.max(0, topCards.length - 1) * EXPANDED_GAP;

  React.useEffect(() => {
    const additionalHeight = Math.max(0, expandedStackHeight - CARD_HEIGHT) + 12;
    onExpansionHeightChange?.(expanded ? additionalHeight : 0, reduceMotion);
  }, [expanded, expandedStackHeight, onExpansionHeightChange, reduceMotion]);

  React.useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  React.useEffect(() => {
    if (collapseRequest > 0) collapse();
  }, [collapse, collapseRequest]);

  React.useEffect(() => {
    progress.stopAnimation();
    if (reduceMotion) {
      progress.setValue(expanded ? 1 : 0);
      return;
    }
    const animation = Animated.spring(progress, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
      damping: 18,
      stiffness: 160,
      mass: 1,
    });
    animation.start();
    return () => animation.stop();
  }, [expanded, progress, reduceMotion]);

  const stackHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [CARD_HEIGHT, expandedStackHeight],
  });
  const marginBottom = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-18, 0],
  });

  const expand = React.useCallback(() => {
    if (topCards.length < 2) {
      Animated.sequence([
        Animated.spring(pressScale, {
          toValue: 1.035,
          useNativeDriver: true,
          damping: 8,
          stiffness: 220,
        }),
        Animated.spring(pressScale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 8,
          stiffness: 220,
        }),
      ]).start();
      return;
    }
    clearTimer();
    setExpanded(true);
  }, [clearTimer, pressScale, topCards.length]);

  const handleCardPress = React.useCallback(async (cardId: string) => {
    if (!expanded) {
      expand();
      return;
    }
    if (balanceCardId === cardId) {
      setBalanceCardId(null);
      restartTimer();
      return;
    }
    if (balancesUnlocked) {
      setBalanceCardId(cardId);
      restartTimer();
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
          'Set up a fingerprint or other biometric on your device to view this card balance.',
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify to view card balance',
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
      });
      if (result.success) {
        setBalancesUnlocked(true);
        setBalanceCardId(cardId);
        restartTimer();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      Alert.alert('Could not verify', message);
    } finally {
      authenticationInProgress.current = false;
    }
  }, [balanceCardId, balancesUnlocked, expand, expanded, restartTimer]);

  React.useEffect(() => {
    if (!expanded) setBalanceCardId(null);
  }, [expanded]);

  return (
    <Animated.View
      style={[
        styles.stackContainer,
        {
          width: stackWidth,
          height: isLoading || topCards.length === 0 ? CARD_HEIGHT : stackHeight,
          marginBottom: isLoading || topCards.length === 0 ? -30 : marginBottom,
          transform: [{ scale: pressScale }],
        },
      ]}
    >
      {isLoading ? (
        <CardSkeleton width={stackWidth} />
      ) : topCards.length > 0 ? (
        <>
          {expanded ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Collapse cards"
              onPress={collapse}
              onPressIn={restartTimer}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Expand cards"
              onPress={expand}
              style={StyleSheet.absoluteFill}
            />
          )}
          {topCards.map((card, rank) => (
            <CardLayer
              key={card.id}
              card={card}
              rank={rank}
              count={topCards.length}
              width={stackWidth}
              expanded={expanded}
              reduceMotion={reduceMotion}
              showBalance={expanded && balanceCardId === card.id}
              onPress={() => handleCardPress(card.id)}
              onInteract={restartTimer}
            />
          ))}
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add your first card"
          onPress={() => onOpenWallet()}
          style={styles.emptyState}  >
          <Text style={styles.emptyStateTitle}>Add your first card</Text>
          <Text style={styles.emptyStateSubtitle}>Tap to open Wallet</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stackContainer: {
    position: 'relative',
    marginTop: 6,
    alignSelf: 'center',
    overflow: 'visible',
  },
  cardLayer: {
    position: 'absolute',
    height: CARD_HEIGHT,
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardPressable: {
    flex: 1,
    padding: 0,
    overflow: 'hidden',
  },
  cardFrontFace: {
    ...StyleSheet.absoluteFill,
    paddingTop: 13,
    paddingHorizontal: 19,
    paddingBottom: 11,
    backfaceVisibility: 'hidden',
  },
  cardBalanceFace: {
    ...StyleSheet.absoluteFill,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  balanceFaceName: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  balanceFaceCaption: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 12,
  },
  balanceFaceAmount: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 3,
  },
  balanceFaceNumber: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 10,
  },
  cardBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cardIdentity: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  cardType: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.4,
    marginTop: 3,
  },
  networkMark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  cardName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardNetwork: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontStyle: 'italic',
    textAlign: 'right',
    includeFontPadding: false,
  },
  mastercardMark: {
    width: 30,
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mastercardBrand: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  mastercardText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  mastercardCircle: {
    width: 17,
    height: 17,
    borderRadius: 9,
  },
  mastercardRed: {
    backgroundColor: '#EB4548',
  },
  mastercardGold: {
    backgroundColor: 'rgba(255,179,62,0.92)',
    marginLeft: -6,
  },
  cardNumberBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    width: 29,
    height: 22,
    borderRadius: 5,
    borderColor: 'rgba(255,255,255,0.46)',
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
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardFooterMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardNumber: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1.1,
  },
  cardHolder: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 7,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  monthlySpendWrap: {
    alignItems: 'flex-end',
    minWidth: 84,
  },
  monthlySpendLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 6,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  monthlySpendValue: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.2,
    maxWidth: 90,
  },
  backCardName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    paddingTop: 1,
    paddingHorizontal: 19,
    textTransform: 'uppercase',
  },
  skeletonCard: {
    position: 'absolute',
    height: CARD_HEIGHT,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  emptyStateTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  emptyStateSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 6,
  },
});
