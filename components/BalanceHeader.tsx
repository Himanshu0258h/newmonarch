import React from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import theme from '../theme';
import CardStack from './CardStack';
import { formatWalletCurrency, getTopCards } from '../context/WalletCardsContext';
import { WalletCard } from '../data/walletCards';

type BalanceHeaderProps = {
  cards: WalletCard[];
  isLoading: boolean;
  onOpenWallet: (cardId?: string) => void;
  onCardStackExpandedChange?: (expanded: boolean) => void;
  collapseCardStackRequest?: number;
  onCollapseCardStack?: () => void;
};

function AnimatedPressable({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style: any;
  children: React.ReactNode;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export default function BalanceHeader({
  cards,
  isLoading,
  onOpenWallet,
  onCardStackExpandedChange,
  collapseCardStackRequest,
  onCollapseCardStack,
}: BalanceHeaderProps) {
  const headerHeight = React.useRef(new Animated.Value(0)).current;
  const baseHeaderHeight = React.useRef(0);
  const additionalHeaderHeight = React.useRef(0);
  const [headerMeasured, setHeaderMeasured] = React.useState(false);
  const [cardStackExpanded, setCardStackExpanded] = React.useState(false);
  const handleExpandedChange = React.useCallback((expanded: boolean) => {
    setCardStackExpanded(expanded);
    onCardStackExpandedChange?.(expanded);
  }, [onCardStackExpandedChange]);
  const handleExpansionHeightChange = React.useCallback((height: number, reduceMotion: boolean) => {
    additionalHeaderHeight.current = height;
    if (!baseHeaderHeight.current) return;
    const nextHeight = baseHeaderHeight.current + height;
    if (reduceMotion) {
      headerHeight.setValue(nextHeight);
      return;
    }
    Animated.spring(headerHeight, {
      toValue: nextHeight,
      useNativeDriver: false,
      damping: 18,
      stiffness: 160,
      mass: 1,
    }).start();
  }, [headerHeight]);

  const handleHeaderLayout = React.useCallback((event: { nativeEvent: { layout: { height: number } } }) => {
    if (baseHeaderHeight.current) return;
    baseHeaderHeight.current = event.nativeEvent.layout.height;
    headerHeight.setValue(baseHeaderHeight.current + additionalHeaderHeight.current);
    setHeaderMeasured(true);
  }, [headerHeight]);

  const frontCard = getTopCards(cards, 3)[0];
  const totalMonthlySpend = cards.reduce((total, card) => {
    const monthlySpend = Number(card.monthlySpend);
    return total + (Number.isFinite(monthlySpend) ? monthlySpend : 0);
  }, 0);
  const balance = frontCard
    ? formatWalletCurrency(totalMonthlySpend, frontCard.currency ?? 'INR')
    : '';
  const decimalIndex = balance.lastIndexOf('.');
  const wholeBalance = decimalIndex >= 0 ? balance.slice(0, decimalIndex) : balance;
  const cents = decimalIndex >= 0 ? balance.slice(decimalIndex) : '';
  const balanceLabel = 'Total Monthly Spend';

  return (
    <Animated.View
      onLayout={handleHeaderLayout}
      style={[
        styles.headerContainer,
        headerMeasured ? { height: headerHeight, maxHeight: 10000 } : null,
      ]}
    >
      <LinearGradient
        colors={['#7A0A00', '#E8420F', '#F5873F']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.headerGradient}
      />
      <View style={styles.headerInner}>
        <View style={styles.topRow}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80' }}
            style={styles.avatar}
          />

          <View style={styles.actionGroup}>
            <AnimatedPressable onPress={() => {}} style={styles.iconButton}>
              <Feather name="bell" size={20} color="rgba(255,255,255,0.9)" />
              <View style={styles.notificationDot} />
            </AnimatedPressable>
          </View>
        </View>

        <Pressable
          disabled={!cardStackExpanded}
          onPress={onCollapseCardStack}
          style={styles.balanceTapArea}
        >
          {frontCard ? (
            <>
              <Text style={styles.balanceLabel} numberOfLines={1}>
                {balanceLabel}
              </Text>
              <Text style={styles.balanceText} numberOfLines={1} adjustsFontSizeToFit>
                <Text style={styles.balanceMain}>{wholeBalance}</Text>
                <Text style={styles.balanceCents}>{cents}</Text>
              </Text>
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpenWallet()}
              style={styles.noBalance}
            >
              <Text style={styles.balanceLabel}>Add your first card</Text>
            </Pressable>
          )}

          <View style={styles.deltaPill}>
            <Text style={styles.deltaArrow}>↗</Text>
            <Text style={styles.deltaText}>2.46% this month</Text>
          </View>
        </Pressable>

        <CardStack
          cards={cards}
          isLoading={isLoading}
          onOpenWallet={onOpenWallet}
          onExpansionHeightChange={handleExpansionHeightChange}
          onExpandedChange={handleExpandedChange}
          collapseRequest={collapseCardStackRequest}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    height: '54%',
    minHeight: 360,
    maxHeight: 400,
    position: 'relative',
    zIndex: 2,
    elevation: 2,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    overflow: 'hidden',
  },
  headerGradient: {
    ...StyleSheet.absoluteFill,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    overflow: 'hidden',
  },
  headerInner: {
    flex: 1,
    zIndex: 1,
    paddingTop: 42,
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
    height: 52,
  },
  actionGroup: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  avatar: {
    width: 50,
    height: 50,
    marginLeft: 6,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  iconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F7C74B',
    borderWidth: 2,
    borderColor: '#F0A14B',
  },
  balanceLabel: {
    textAlign: 'center',
    color: theme.colors.white,
    opacity: 0.82,
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: -0.4,
    marginTop: 16,
  },
  balanceTapArea: {
    alignSelf: 'stretch',
  },
  noBalance: {
    alignSelf: 'center',
    marginTop: 22,
    marginBottom: 8,
  },
  balanceText: {
    textAlign: 'center',
    marginTop: 3,
    marginBottom: 8,
  },
  balanceMain: {
    color: theme.colors.white,
    fontSize: 44,
    fontWeight: '600',
    letterSpacing: -1.6,
  },
  balanceCents: {
    color: theme.colors.white,
    opacity: 0.5,
    fontSize: 44,
    fontWeight: '600',
    letterSpacing: -1.6,
  },
  deltaPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    marginBottom: 8,
  },
  deltaArrow: {
    color: theme.colors.white,
    fontSize: 12,
    marginRight: 6,
    opacity: 0.9,
  },
  deltaText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: -0.2,
    opacity: 0.9,
  },
});
