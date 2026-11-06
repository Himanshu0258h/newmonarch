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
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '../../theme';
import type { ChartPoint } from '../../utils/chartMath';
import type { SpendingPeriod } from '../../hooks/useSpendingData';
import AnimatedNumber from './AnimatedNumber';
import PeriodMenu from './PeriodMenu';
import SmoothAreaChart from './SmoothAreaChart';

type Props = {
  width: number;
  height: number;
  total: number;
  points: readonly ChartPoint[];
  selectedIndex: number;
  period: SpendingPeriod;
  onPeriodChange: (period: SpendingPeriod) => void;
  masked: boolean;
  reducedMotion: boolean;
};

function ExpenseChartCard({
  width,
  height,
  total,
  points,
  selectedIndex,
  period,
  onPeriodChange,
  masked,
  reducedMotion,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const scaleFactor = Math.min(1.08, Math.max(0.82, screenWidth / 390));
  const [chartWidth, setChartWidth] = React.useState(0);
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

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
        <LinearGradient
          colors={[theme.colors.spendingCardStart, theme.colors.spendingCardEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <Svg width={120} height={100} viewBox="0 0 120 100" style={styles.watermark}>
            <Path
              d="M12 82 56 38l20 20 32-44M83 14h25v25"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.04}
            />
          </Svg>
          <View style={styles.headerRow}>
            <View style={styles.titleGroup}>
              <View style={styles.iconChip}>
                <Ionicons name="wallet-outline" size={17 * scaleFactor} color="#0B1020" />
              </View>
              <Text style={[styles.label, { fontSize: 15 * scaleFactor }]}>Expense</Text>
            </View>
            <PeriodMenu value={period} onChange={onPeriodChange} />
          </View>
          <View style={styles.amountBlock}>
            {masked ? (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                accessibilityLabel="Expense total, hidden until balances are unlocked"
                style={[styles.amount, { fontSize: 22 * scaleFactor }]}
              >
                −₹ ••••••
              </Text>
            ) : (
              <AnimatedNumber
                amount={-total}
                animate={!reducedMotion}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                accessibilityLabel={`Expense total, ${total.toLocaleString('en-IN')} rupees`}
                style={[styles.amount, { fontSize: 22 * scaleFactor }]}
              />
            )}
          </View>
          <View
            onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
            style={styles.chartWrap}
          >
            {chartWidth > 0 ? (
              <SmoothAreaChart
                points={points}
                width={chartWidth}
                height={58 * scaleFactor}
                selectedIndex={selectedIndex}
                masked={masked}
              />
            ) : null}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowContainer: {
    borderRadius: theme.spending.cardRadius,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  pressArea: {
    flex: 1,
  },
  card: {
    flex: 1,
    overflow: 'hidden',
    padding: 12,
    borderRadius: theme.spending.cardRadius,
    borderWidth: 1,
    borderColor: theme.colors.spendingBorder,
  },
  watermark: {
    position: 'absolute',
    right: -25,
    bottom: -22,
  },
  headerRow: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  titleGroup: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  amountBlock: {
    marginTop: 3,
  },
  amount: {
    width: '100%',
    minWidth: 0,
    height: 30,
    padding: 0,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: -0.35,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  chartWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    marginTop: 2,
    overflow: 'visible',
  },
});

export default React.memo(ExpenseChartCard);
