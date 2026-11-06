import React from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { CATEGORY_MANAGER_GRADIENT, HOME_HEADER_GRADIENT } from '../../theme/gradients';
import theme from '../../theme';

export const FANCY_BG = true;
const SHEET_COLOR = theme.colors.warmSheet;

type WalletBackgroundProps = {
  activeCardColor?: string;
  scrollY: SharedValue<number>;
  variant?: 'default' | 'compact' | 'activity';
};

type AuroraBlobProps = {
  color: string;
  diameter: number;
  left: number;
  top: number;
  duration: number;
  delay: number;
  scrollY: SharedValue<number>;
  reducedMotion: boolean;
  baseOpacity?: number;
};

const AuroraBlob = React.memo(function AuroraBlob({
  color,
  diameter,
  left,
  top,
  duration,
  delay,
  scrollY,
  reducedMotion,
  baseOpacity = 1,
}: AuroraBlobProps) {
  const movement = useSharedValue(0);
  const gradientId = `wallet-aurora-${color.replace('#', '')}`;
  const motionStyle = useAnimatedStyle(() => ({
    opacity: baseOpacity * interpolate(scrollY.value, [0, 620], [1, 0.6], 'clamp'),
    transform: [
      { translateX: interpolate(movement.value, [0, 1], [-24, 24]) },
      { translateY: interpolate(movement.value, [0, 1], [18, -18]) },
      { scale: interpolate(movement.value, [0, 1], [1, 1.08]) },
    ],
  }));

  React.useEffect(() => {
    if (reducedMotion) return;
    movement.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
    return () => cancelAnimation(movement);
  }, [delay, duration, movement, reducedMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      renderToHardwareTextureAndroid
      style={[
        styles.blob,
        { width: diameter, height: diameter, left, top },
        motionStyle,
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.55} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
});

type ColorGlowProps = {
  color: string;
  width: number;
  height: number;
  left: number;
  scrollY: SharedValue<number>;
};

const ColorGlow = React.memo(function ColorGlow({
  color,
  width,
  height,
  left,
  scrollY,
}: ColorGlowProps) {
  const [colors, setColors] = React.useState({ previous: color, next: color });
  const transition = useSharedValue(1);
  const previousStyle = useAnimatedStyle(() => ({
    opacity: (1 - transition.value) * interpolate(scrollY.value, [0, 620], [1, 0.6], 'clamp'),
  }));
  const nextStyle = useAnimatedStyle(() => ({
    opacity: transition.value * interpolate(scrollY.value, [0, 620], [1, 0.6], 'clamp'),
  }));

  React.useEffect(() => {
    setColors((current) => ({ previous: current.next, next: color }));
    transition.value = 0;
    transition.value = withTiming(1, { duration: 400 });
  }, [color, transition]);

  return (
    <View pointerEvents="none" style={[styles.glow, { width, height, left }]}>
      <Animated.View style={[StyleSheet.absoluteFill, previousStyle]}>
        <RadialGlow color={colors.previous} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, nextStyle]}>
        <RadialGlow color={colors.next} />
      </Animated.View>
    </View>
  );
});

const RadialGlow = React.memo(function RadialGlow({ color }: { color: string }) {
  const gradientId = `wallet-card-glow-${color.replace('#', '')}`;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
    </Svg>
  );
});

function WalletBackground({ activeCardColor, scrollY, variant = 'default' }: WalletBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const compact = variant !== 'default';
  const categoryCompact = variant === 'compact';
  const showAurora = FANCY_BG && (!compact || Platform.OS !== 'android');
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(scrollY.value, [0, 600], [-20, 70], 'clamp') },
      { rotate: '-20deg' },
    ],
    opacity: interpolate(scrollY.value, [0, 620], [1, 0.6], 'clamp'),
  }));
  const backgroundHeight = height * (compact ? 0.34 : 0.62) + 400;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={categoryCompact ? [...CATEGORY_MANAGER_GRADIENT, SHEET_COLOR] : [...HOME_HEADER_GRADIENT, SHEET_COLOR]}
        locations={categoryCompact ? [0, 0.22, 0.48, 0.75, 1] : [0, 0.33, 0.68, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.baseGradient, { top: -400, height: backgroundHeight }]}
      />

      {showAurora ? (
        <>
          <AuroraBlob
            color="#FF6A2A"
            diameter={width * (compact ? 0.9 : 1.1)}
            left={width * (compact ? 0.34 : 0.4)}
            top={height * 0.03}
            duration={compact ? 18000 : 16000}
            delay={0}
            scrollY={scrollY}
            reducedMotion={reducedMotion}
            baseOpacity={compact ? 0.4 : 1}
          />
          <AuroraBlob
            color="#B1124A"
            diameter={width * (compact ? 0.85 : 1)}
            left={-width * (compact ? 0.35 : 0.5)}
            top={height * 0.17}
            duration={compact ? 22000 : 21000}
            delay={2600}
            scrollY={scrollY}
            reducedMotion={reducedMotion}
            baseOpacity={compact ? 0.4 : 1}
          />
          {!compact ? <AuroraBlob
            color="#FFB35C"
            diameter={width * 0.9}
            left={width * 0.05}
            top={height * 0.25}
            duration={14000}
            delay={5100}
            scrollY={scrollY}
            reducedMotion={reducedMotion}
          /> : null}
          {!compact && activeCardColor ? (
            <ColorGlow
              color={activeCardColor}
              width={width * 1.1}
              height={width * 0.8}
              left={-width * 0.05}
              scrollY={scrollY}
            />
          ) : null}
          {!compact ? <Animated.View style={[styles.sheen, sheenStyle]}>
            <LinearGradient
              colors={[
                'rgba(255,255,255,0.10)',
                'rgba(255,255,255,0)',
                'rgba(255,255,255,0.06)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View> : null}
        </>
      ) : null}

      {FANCY_BG ? (
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.vignette}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  baseGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  blob: {
    position: 'absolute',
  },
  glow: {
    position: 'absolute',
    top: '15%',
  },
  sheen: {
    position: 'absolute',
    width: '150%',
    height: '45%',
    left: '-25%',
    top: '-5%',
  },
  vignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
  },
});

export default React.memo(WalletBackground);
