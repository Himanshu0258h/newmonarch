import React from 'react';
import { Platform, StyleSheet, View, ViewProps, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BLUR_HEIGHT = 110;
const FALLBACK_HEIGHT = 200;
const BLUR_LAYERS = [
  { intensity: 8, visibleStart: 0.2 },
  { intensity: 18, visibleStart: 0.4 },
  { intensity: 30, visibleStart: 0.6 },
  { intensity: 45, visibleStart: 0.78 },
  { intensity: 60, visibleStart: 0.9 },
] as const;
const FADE_COLORS = [
  'rgba(255,255,255,0.65)',
  'rgba(255,255,255,0.84)',
  'rgba(255,255,255,0.96)',
  '#FFFFFF',
] as const;
const FADE_LOCATIONS = [0, 0.35, 0.7, 1] as const;

type MaskedViewProps = ViewProps & {
  maskElement: React.ReactElement;
};

const CompatibleMaskedView =
  MaskedView as unknown as React.ComponentType<MaskedViewProps>;

export default function BottomFadeBlur() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const androidVersion = Platform.OS === 'android' ? Number(Platform.Version) : undefined;
  const blurSupported = Platform.OS !== 'android' || (androidVersion ?? 0) >= 31;
  const height = blurSupported
    ? insets.bottom + Math.min(BLUR_HEIGHT, screenHeight * 0.24)
    : Math.min(FALLBACK_HEIGHT, screenHeight * 0.32);

  return (
    <View pointerEvents="none" style={[styles.container, { height }]}>
      {blurSupported
        ? BLUR_LAYERS.map(({ intensity, visibleStart }) => (
            <CompatibleMaskedView
              key={intensity}
              style={StyleSheet.absoluteFill}
              maskElement={
                <LinearGradient
                  colors={['transparent', 'transparent', '#000000', '#000000']}
                  locations={[0, visibleStart, Math.min(visibleStart + 0.15, 1), 1]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                />
              }
            >
              <BlurView
                tint="light"
                intensity={intensity}
                {...(Platform.OS === 'android'
                  ? { experimentalBlurMethod: 'dimezisBlurView' as const }
                  : {})}
                style={StyleSheet.absoluteFill}
              />
            </CompatibleMaskedView>
          ))
        : null}
      <LinearGradient
        colors={FADE_COLORS}
        locations={FADE_LOCATIONS}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    elevation: 2,
  },
});
