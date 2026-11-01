import React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const blurLayers = [
  { intensity: 8, start: 0.2 },
  { intensity: 18, start: 0.4 },
  { intensity: 30, start: 0.6 },
  { intensity: 45, start: 0.78 },
  { intensity: 60, start: 0.9 },
];

const fadeColors = [
  'rgba(255,255,255,0)',
  'rgba(255,255,255,0.55)',
  'rgba(255,255,255,0.92)',
  '#FFFFFF',
] as const;

type MaskedViewProps = ViewProps & {
  maskElement: React.ReactElement;
};

const CompatibleMaskedView =
  MaskedView as unknown as React.ComponentType<MaskedViewProps>;

export default function BottomFadeBlur() {
  const insets = useSafeAreaInsets();
  const androidVersion = Platform.OS === 'android' ? Number(Platform.Version) : undefined;
  const blurSupported = Platform.OS !== 'android' || (androidVersion ?? 0) >= 31;
  const height = blurSupported ? insets.bottom + 145 : 170;

  return (
    <View pointerEvents="none" style={[styles.container, { height }]}>
      {blurSupported &&
        blurLayers.map(({ intensity, start }) => (
          <CompatibleMaskedView
            key={intensity}
            style={StyleSheet.absoluteFill}
            maskElement={
              <LinearGradient
                colors={['transparent', 'transparent', '#000000', '#000000']}
                locations={[0, start, Math.min(start + 0.15, 1), 1]}
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
        ))}
      <LinearGradient
        pointerEvents="none"
        colors={fadeColors}
        locations={[0, 0.35, 0.7, 1]}
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
  },
});
