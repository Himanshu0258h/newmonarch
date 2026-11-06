import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '../../theme';
import AnimatedNumber from './AnimatedNumber';

type Props = {
  width: number;
  height: number;
  total: number;
  previousTotal: number;
  changePct: number;
  hasTransactions: boolean;
  masked: boolean;
  reducedMotion: boolean;
};

function MySpendingCard({
  width,
  height,
  total,
  previousTotal,
  changePct,
  hasTransactions,
  masked,
  reducedMotion,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const scaleFactor = Math.min(1.08, Math.max(0.82, screenWidth / 390));
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const noChange = previousTotal === 0 && changePct === 0;
  const resolvedTrendColor = '#0B1020';
  const percentage = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(changePct));

  return (
    <Animated.View style={[styles.shadowContainer, { width, height }, pressStyle]}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 18, stiffness: 220 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 220 });
        }}
        style={styles.pressArea}
      >
        <View style={styles.card}>
          <Svg width={110} height={110} viewBox="0 0 110 110" style={styles.watermark}>
            <Path
              d="M10 92 52 50l18 18 30-42M72 26h28v28"
              fill="none"
              stroke="#e2370d"
              strokeWidth={13}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.1}
              
            />
          </Svg>
          <View style={styles.titleRow}>
            <View style={styles.titleLeading}>
              <View style={styles.iconChip}>
                <Ionicons name="receipt-outline" size={17 * scaleFactor} color="#0B1020" />
              </View>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.66}
                style={[styles.label, { fontSize: 15 * scaleFactor }]}
              >
                My Spending
              </Text>
            </View>
          </View>
          <View style={styles.trendRow}>
            <Ionicons
              name={!hasTransactions || noChange
                ? 'remove'
                : changePct < 0
                  ? 'trending-down'
                  : 'trending-up'}
              size={13 * scaleFactor}
              color={resolvedTrendColor}
            />
            <Text style={[styles.trendText, { color: resolvedTrendColor, fontSize: 13 * scaleFactor }]}>
              {!hasTransactions
                ? 'No spending yet'
                : noChange
                  ? 'No change'
                  : `${percentage}%`}
            </Text>
          </View>
          <View style={styles.amountWrap}>
            {masked ? (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                accessibilityLabel="Total spending, hidden until balances are unlocked"
                style={[styles.amount, { fontSize: 26 * scaleFactor }]}
              >
                ₹ ••••••
              </Text>
            ) : (
              <AnimatedNumber
                amount={total}
                animate={!reducedMotion}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                accessibilityLabel={`Total spending, ${total.toLocaleString('en-IN')} rupees`}
                style={[styles.amount, { fontSize: 26 * scaleFactor }]}
              />
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowContainer: {
    borderRadius: theme.spending.cardRadius,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  pressArea: {
    flex: 1,
  },
  card: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: theme.colors.spendingCardSolid,
    padding: 12,
    justifyContent: 'space-between',
    borderRadius: theme.spending.cardRadius,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  watermark: {
    position: 'absolute',
    right: -17,
    top: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  titleLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexShrink: 1,
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F2F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    color: '#0B1020',
    fontWeight: '500',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontWeight: '600',
  },
  amountWrap: {
    alignSelf: 'stretch',
    marginLeft: 3,
  },
  amount: {
    width: '100%',
    minWidth: 0,
    height: 34,
    padding: 0,
    color: '#0B1020',
    fontWeight: '700',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
});

export default React.memo(MySpendingCard);
