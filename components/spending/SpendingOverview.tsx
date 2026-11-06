import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../../theme';
import type { WalletCard } from '../../data/walletCards';
import { useSpendingData } from '../../hooks/useSpendingData';
import MySpendingCard from './MySpendingCard';

type Props = {
  cards: readonly WalletCard[];
  selectedCardId: string;
  masked: boolean;
  isLoading: boolean;
  onViewAll: () => void;
};

function SpendingSkeleton({ width, height }: { width: number; height: number }) {
  return <View style={[styles.skeletonCard, { width, height }]} />;
}

function SpendingOverview({
  cards,
  selectedCardId,
  masked,
  isLoading,
  onViewAll,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const scaleFactor = Math.min(1.08, Math.max(0.82, screenWidth / 390));
  const reduceMotion = useReducedMotion();
  const { totalSpent, previousTotal, changePct, hasTransactions } = useSpendingData(
    'month',
    cards,
    selectedCardId,
    isLoading,
  );
  const headerProgress = useSharedValue(0);
  const leftCardProgress = useSharedValue(0);
  const hasEntered = React.useRef(false);
  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerProgress.value,
  }));
  const leftCardStyle = useAnimatedStyle(() => ({
    opacity: leftCardProgress.value,
    transform: [{ translateY: (1 - leftCardProgress.value) * 16 }],
  }));
  const previousCardId = React.useRef(selectedCardId);
  React.useEffect(() => {
    if (hasEntered.current) return;
    if (isLoading) return;
    hasEntered.current = true;
    headerProgress.value = 0;
    leftCardProgress.value = 0;
    if (reduceMotion) {
      headerProgress.value = withTiming(1, { duration: 140 });
      leftCardProgress.value = withDelay(30, withTiming(1, { duration: 140 }));
      return;
    }
    headerProgress.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
    leftCardProgress.value = withDelay(
      30,
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
    );
  }, [headerProgress, isLoading, leftCardProgress, reduceMotion]);

  React.useEffect(() => {
    if (previousCardId.current === selectedCardId) return;
    previousCardId.current = selectedCardId;
    leftCardProgress.value = 0;
    leftCardProgress.value = withTiming(1, {
      duration: reduceMotion ? 120 : 180,
      easing: Easing.out(Easing.cubic),
    });
  }, [leftCardProgress, reduceMotion, selectedCardId]);

  const cardWidth = Math.max(0, screenWidth - theme.spending.sideMargin * 2);
  const cardHeight = theme.spending.cardHeight * scaleFactor;

  return (
    <View
      style={[
        styles.section,
        {
          height: cardHeight + 32 * scaleFactor + 20 * scaleFactor + 16 * scaleFactor,
          paddingVertical: 16 * scaleFactor,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.heading,
          {
            marginHorizontal: theme.spending.sideMargin,
            marginBottom: 16 * scaleFactor,
            height: 20 * scaleFactor,
          },
          headerStyle,
        ]}
      >
        <Text style={[styles.headingText, { fontSize: 17 * scaleFactor }]}>
          Spending Overview
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onViewAll}
          hitSlop={8}
        >
          <Text style={[styles.viewAll, { fontSize: 13 * scaleFactor }]}>View All</Text>
        </Pressable>
      </Animated.View>
      <View style={[styles.cardsRow, { height: cardHeight }]}>
        {isLoading ? (
          <SpendingSkeleton width={cardWidth} height={cardHeight} />
        ) : (
          <Animated.View style={[{ width: cardWidth, height: cardHeight }, leftCardStyle]}>
            <MySpendingCard
              width={cardWidth}
              height={cardHeight}
              total={totalSpent}
              previousTotal={previousTotal}
              changePct={changePct}
              hasTransactions={hasTransactions}
              masked={masked}
              reducedMotion={reduceMotion}
            />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headingText: {
    color: '#252525',
    fontWeight: '600',
  },
  viewAll: {
    color: '#929292',
  },
  cardsRow: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: theme.spending.cardGap,
    marginHorizontal: theme.spending.sideMargin,
  },
  skeletonCard: {
    borderRadius: theme.spending.cardRadius,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: theme.colors.spendingBorder,
  },
});

export default React.memo(SpendingOverview);
