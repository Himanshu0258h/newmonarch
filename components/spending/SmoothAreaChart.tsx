import React from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import type { ChartPoint } from '../../utils/chartMath';
import {
  approximatePathLength,
  createAreaPath,
  createSmoothPath,
  getPlottedPoints,
} from '../../utils/chartMath';
import { formatSpendingAmount } from '../../hooks/useSpendingData';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = {
  points: readonly ChartPoint[];
  width: number;
  height?: number;
  selectedIndex: number;
  masked: boolean;
};

type ChartPaths = { line: string; area: string };

function tooltipValue(value: number, masked: boolean) {
  return masked ? '••••' : `−${formatSpendingAmount(value)}`;
}

function Tooltip({
  x,
  y,
  activeIndex,
  index,
  value,
  width,
}: {
  x: number;
  y: number;
  activeIndex: SharedValue<number>;
  index: number;
  value: string;
  width: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: Math.round(activeIndex.value) === index ? 1 : 0,
  }));
  const tooltipWidth = Math.min(width, Math.max(62, value.length * 7 + 12));
  const left = Math.max(0, Math.min(width - tooltipWidth, x - tooltipWidth / 2));
  return (
    <Animated.View accessible={false} pointerEvents="none" style={[styles.tooltip, { left, width: tooltipWidth, top: Math.max(0, y - 33) }, style]}>
      <Animated.Text accessible={false} numberOfLines={1} adjustsFontSizeToFit style={styles.tooltipText}>{value}</Animated.Text>
      <View style={styles.tooltipPointer} />
    </Animated.View>
  );
}

function ChartContents({ points, width, height = 64, selectedIndex, masked }: Props) {
  const reduceMotion = useReducedMotion();
  const plotted = React.useMemo(
    () => getPlottedPoints(points, width, height),
    [height, points, width],
  );
  const linePath = React.useMemo(() => createSmoothPath(plotted), [plotted]);
  const areaPath = React.useMemo(() => createAreaPath(plotted, height), [height, plotted]);
  const pathLength = React.useMemo(() => Math.max(1, approximatePathLength(plotted)), [plotted]);
  const chartProgress = useSharedValue(0);
  const areaOpacity = useSharedValue(0);
  const pathFade = useSharedValue(1);
  const [previousPaths, setPreviousPaths] = React.useState<ChartPaths | null>(null);
  const currentPaths = React.useRef<ChartPaths>({ line: '', area: '' });
  const hasDrawn = React.useRef(false);
  const activeIndex = useSharedValue(Math.max(0, selectedIndex));
  const lastHapticIndex = useSharedValue(Math.max(0, selectedIndex));
  const defaultIndex = Math.max(0, selectedIndex);
  const hasData = points.some((point) => point.value > 0);
  const indexInput = React.useMemo(() => plotted.map((_, index) => index), [plotted]);
  const xValues = React.useMemo(() => plotted.map((point) => point.x), [plotted]);
  const yValues = React.useMemo(() => plotted.map((point) => point.y), [plotted]);
  const selectedPoint = plotted[defaultIndex];
  const gradientId = React.useId().replace(/:/g, '');

  React.useEffect(() => {
    if (width <= 0) return;
    const previous = currentPaths.current;
    const hasPreviousPath = hasDrawn.current && previous.line !== linePath;
    if (hasPreviousPath && previous.line && linePath) {
      setPreviousPaths(previous);
      pathFade.value = 0;
      pathFade.value = withTiming(
        1,
        { duration: reduceMotion ? 180 : 250, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setPreviousPaths)(null);
        },
      );
    }
    currentPaths.current = { line: linePath, area: areaPath };

    if (!hasDrawn.current) {
      hasDrawn.current = true;
      chartProgress.value = reduceMotion
        ? 1
        : withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
      areaOpacity.value = withTiming(1, { duration: reduceMotion ? 180 : 450 });
    } else if (reduceMotion && !areaPath) {
      areaOpacity.value = withTiming(1, { duration: 180 });
    }
  }, [areaPath, chartProgress, linePath, pathFade, reduceMotion, areaOpacity, width]);

  React.useEffect(() => {
    activeIndex.value = defaultIndex;
    lastHapticIndex.value = defaultIndex;
  }, [activeIndex, defaultIndex, lastHapticIndex]);

  const chartAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - chartProgress.value),
    opacity: previousPaths ? pathFade.value : 1,
  }));
  const areaAnimatedProps = useAnimatedProps(() => ({
    opacity: areaOpacity.value * (previousPaths ? pathFade.value : 1),
  }));
  const oldLineAnimatedProps = useAnimatedProps(() => ({
    opacity: 1 - pathFade.value,
  }));
  const oldAreaAnimatedProps = useAnimatedProps(() => ({
    opacity: areaOpacity.value * (1 - pathFade.value),
  }));
  const dotAnimatedProps = useAnimatedProps(() => ({
    cx: plotted.length ? interpolate(activeIndex.value, indexInput, xValues) : 0,
    cy: plotted.length ? interpolate(activeIndex.value, indexInput, yValues) : 0,
  }));
  const guideAnimatedProps = useAnimatedProps(() => ({
    x1: plotted.length ? interpolate(activeIndex.value, indexInput, xValues) : 0,
    x2: plotted.length ? interpolate(activeIndex.value, indexInput, xValues) : 0,
    y1: plotted.length ? interpolate(activeIndex.value, indexInput, yValues) : 0,
    y2: height,
  }));

  const selectionChanged = React.useCallback((index: number) => {
    void Haptics.selectionAsync();
  }, []);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-8, 8])
        .onUpdate((event) => {
          if (plotted.length < 2) return;
          const index = Math.max(
            0,
            Math.min(plotted.length - 1, Math.round((event.x / width) * (plotted.length - 1))),
          );
          if (index !== lastHapticIndex.value) {
            lastHapticIndex.value = index;
            runOnJS(selectionChanged)(index);
          }
          activeIndex.value = withTiming(index, { duration: 70 });
        })
        .onEnd(() => {
          activeIndex.value = withSpring(defaultIndex, { damping: 20, stiffness: 170 });
          lastHapticIndex.value = defaultIndex;
        }),
    [activeIndex, defaultIndex, lastHapticIndex, plotted.length, selectionChanged, width],
  );

  const accessibilityValue =
    points[defaultIndex]?.value ?? 0;
  const handleAccessibilityAction = React.useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      const change = event.nativeEvent.actionName === 'increment' ? 1 : -1;
      const next = Math.max(0, Math.min(points.length - 1, defaultIndex + change));
      activeIndex.value = withSpring(next, { damping: 20, stiffness: 170 });
      AccessibilityInfo.announceForAccessibility(
        `${points[next]?.label ?? ''}, ${tooltipValue(points[next]?.value ?? 0, masked)}`,
      );
    },
    [activeIndex, defaultIndex, masked, points],
  );

  if (width <= 0) return null;

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Spending chart"
        accessibilityValue={{ min: 0, max: Math.max(0, points.length - 1), now: defaultIndex, text: tooltipValue(accessibilityValue, masked) }}
        accessibilityActions={[
          { name: 'increment', label: 'Next chart point' },
          { name: 'decrement', label: 'Previous chart point' },
        ]}
        onAccessibilityAction={handleAccessibilityAction}
        style={{ width, height, overflow: 'visible' }}
      >
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.22" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {!hasData ? (
            <Line
              x1={0}
              y1={height / 2}
              x2={width}
              y2={height / 2}
              stroke="rgba(255,255,255,0.45)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ) : (
            <>
              {areaPath ? (
                previousPaths?.area ? (
                  <AnimatedPath
                    d={previousPaths.area}
                    fill={`url(#${gradientId})`}
                    animatedProps={oldAreaAnimatedProps}
                  />
                ) : null
              ) : null}
              {areaPath ? (
                <AnimatedPath
                  d={areaPath}
                  fill={`url(#${gradientId})`}
                  animatedProps={areaAnimatedProps}
                />
              ) : null}
              {plotted.length === 1 ? (
                <Circle
                  cx={plotted[0].x}
                  cy={plotted[0].y}
                  r={3}
                  fill="#FFFFFF"
                />
              ) : (
                <>
                  {previousPaths?.line ? (
                    <AnimatedPath
                      d={previousPaths.line}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      animatedProps={oldLineAnimatedProps}
                    />
                  ) : null}
                  <AnimatedPath
                    d={linePath}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={`${pathLength} ${pathLength}`}
                    animatedProps={chartAnimatedProps}
                  />
                </>
              )}
              {selectedPoint && plotted.length > 1 ? (
                <>
                  <AnimatedLine
                    stroke="rgba(255,255,255,0.25)"
                    strokeWidth={1}
                    strokeDasharray="2 3"
                    animatedProps={guideAnimatedProps}
                  />
                  <AnimatedCircle
                    r={5}
                    fill="#FFFFFF"
                    stroke={theme.colors.spendingBackground}
                    strokeWidth={2.5}
                    animatedProps={dotAnimatedProps}
                  />
                </>
              ) : null}
            </>
          )}
        </Svg>
        {hasData && plotted.length > 1
          ? plotted.map((point, index) => {
              return (
                <Tooltip
                  key={`${point.label}-${index}`}
                  x={point.x}
                  y={point.y}
                  width={width}
                  activeIndex={activeIndex}
                  index={index}
                  value={tooltipValue(point.value, masked)}
                />
              );
            })
          : null}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    minWidth: 62,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipText: {
    color: '#0B1020',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  tooltipPointer: {
    position: 'absolute',
    bottom: -3,
    width: 6,
    height: 6,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
});

export default React.memo(function SmoothAreaChart(props: Props) {
  return <ChartContents {...props} />;
});
