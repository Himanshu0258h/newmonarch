import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import theme from '../theme';

type Props = {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
};

function lightenColor(color: string) {
  const parsed = Number.parseInt(color.replace('#', ''), 16);
  if (!Number.isFinite(parsed)) return color;
  const channels = [
    (parsed >> 16) & 255,
    (parsed >> 8) & 255,
    parsed & 255,
  ].map((channel) => Math.min(255, channel + 32));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function CategoryGradientBadge({ color, icon, size = 64 }: Props) {
  return (
    <View
      style={[
        theme.shadows.categoryBadge,
        {
          width: size,
          height: size,
          borderRadius: theme.radii.categoryBadge,
          shadowColor: color,
        },
      ]}
    >
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: theme.radii.categoryBadge,
          },
        ]}
      >
        <LinearGradient
          colors={[lightenColor(color), color]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name={icon} size={size * 0.4} color={theme.colors.white} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default React.memo(CategoryGradientBadge);
