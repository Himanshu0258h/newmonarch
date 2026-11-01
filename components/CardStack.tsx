import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  formatWalletCurrency,
  getTopCards,
} from '../context/WalletCardsContext';
import { WalletCard } from '../data/walletCards';

type CardStackProps = {
  cards: WalletCard[];
  isLoading?: boolean;
  onOpenWallet: (cardId?: string) => void;
};

function colorWithOpacity(color: string | null | undefined, opacity: number) {
  const hex = color?.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
  if (!hex) return `rgba(255,255,255,${opacity})`;

  const expanded = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
  const red = Number.parseInt(expanded.slice(0, 2), 16);
  const green = Number.parseInt(expanded.slice(2, 4), 16);
  const blue = Number.parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${opacity})`;
}

function displayCardName(card: WalletCard) {
  return card.displayName?.trim() || card.holder?.trim() || card.bank?.trim() || 'Wallet card';
}

function CardLayer({
  card,
  position,
  isFront,
  width,
  onPress,
}: {
  card: WalletCard;
  position: number;
  isFront: boolean;
  width: number;
  onPress: () => void;
}) {
  const inset = 52 - position * 16;
  const top = position * 16;
  const opacity = position === 0 ? 0.75 : position === 1 ? 0.9 : 1;
  const animatedWidth = React.useRef(new Animated.Value(width - inset * 2)).current;
  const animatedLeft = React.useRef(new Animated.Value(inset)).current;
  const animatedTop = React.useRef(new Animated.Value(top)).current;
  const cardColor = card.colors?.[0] ?? '#D56B37';
  const cardName = displayCardName(card);
  const cardNumber = card.number?.trim();
  const cardBalance = formatWalletCurrency(card.balance, card.currency ?? 'INR');

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(animatedWidth, {
        toValue: width - inset * 2,
        useNativeDriver: false,
        tension: 65,
        friction: 10,
      }),
      Animated.spring(animatedLeft, {
        toValue: inset,
        useNativeDriver: false,
        tension: 65,
        friction: 10,
      }),
      Animated.spring(animatedTop, {
        toValue: top,
        useNativeDriver: false,
        tension: 65,
        friction: 10,
      }),
    ]).start();
  }, [animatedLeft, animatedTop, animatedWidth, inset, top, width]);

  return (
    <Animated.View
      style={[
        styles.cardLayer,
        {
          width: animatedWidth,
          left: animatedLeft,
          top: animatedTop,
          opacity,
          zIndex: position + 1,
          elevation: position + 1,
        },
      ]}
      pointerEvents={isFront ? 'auto' : 'none'}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open Wallet, ${cardName}`}
        onPress={onPress}
        style={styles.cardPressable}
      >
        <LinearGradient
          colors={[colorWithOpacity(cardColor, 0.85), colorWithOpacity(cardColor, 0.55)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardBorder} />

        {isFront ? (
          <View style={styles.frontContent}>
            <View style={styles.cardTitleRow}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={styles.cardName}>
                {cardName}
              </Text>
              <Text numberOfLines={1} style={styles.cardNetwork}>
                {card.network?.trim() || card.type || 'CARD'}
              </Text>
            </View>
            <View style={styles.cardDetailsRow}>
              <Text numberOfLines={1} style={styles.cardNumber}>
                {cardNumber || cardName}
              </Text>
              {cardNumber ? (
                <Text numberOfLines={1} style={styles.cardExpiry}>
                  {card.expiry?.trim() || '08 / 32'}
                </Text>
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.cardBalance}>
              {cardBalance}
            </Text>
          </View>
        ) : (
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.backCardName}>
            {cardName}
          </Text>
        )}
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
              width: width - (20 + position * 16) * 2,
              left: 20 + position * 16,
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
}: CardStackProps) {
  const { width: screenWidth } = useWindowDimensions();
  const stackWidth = screenWidth - 40;
  const topCards = React.useMemo(() => getTopCards(cards, 3), [cards]);
  const visualCards = React.useMemo(() => [...topCards].reverse(), [topCards]);

  return (
    <View style={[styles.stackContainer, { width: stackWidth }]}>
      {isLoading ? (
        <CardSkeleton width={stackWidth} />
      ) : topCards.length > 0 ? (
        visualCards.map((card, position) => (
          <CardLayer
            key={card.id}
            card={card}
            position={position}
            isFront={card.id === topCards[0]?.id}
            width={stackWidth}
            onPress={() => onOpenWallet(topCards[0]?.id)}
          />
        ))
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenWallet()}
          style={styles.emptyState}
        >
          <Text style={styles.emptyStateTitle}>Add your first card</Text>
          <Text style={styles.emptyStateSubtitle}>Tap to open Wallet</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stackContainer: {
    position: 'relative',
    height: 190,
    marginTop: 6,
    marginBottom: -30,
    alignSelf: 'center',
  },
  cardLayer: {
    position: 'absolute',
    height: 190,
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardPressable: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  cardBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 24,
  },
  frontContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cardNetwork: {
    maxWidth: '42%',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    fontWeight: '700',
    fontStyle: 'italic',
    textAlign: 'right',
  },
  cardDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  cardNumber: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  cardExpiry: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    fontWeight: '500',
  },
  cardBalance: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 10,
  },
  backCardName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    paddingTop: 1,
    paddingHorizontal: 24,
  },
  skeletonCard: {
    position: 'absolute',
    height: 190,
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
