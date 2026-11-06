import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import theme from '../theme';

type ActionRowProps = {
  onDeposit: () => void;
  onSwap: () => void;
  onWithdraw: () => void;
  isLoading?: boolean;
};

function AnimatedPressable({
  onPress,
  haptic = false,
  disabled = false,
  style,
  children,
}: {
  onPress: () => void;
  haptic?: boolean;
  disabled?: boolean;
  style: any;
  children: React.ReactNode;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 180,
      friction: 10,
    }).start();
  };

  return (
    <Pressable
      style={style}
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        Animated.spring(scale, {
          toValue: 0.97,
          useNativeDriver: true,
          tension: 180,
          friction: 10,
        }).start();
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.animatedContent, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function ActionRow({
  onDeposit,
  onSwap,
  onWithdraw,
  isLoading = false,
}: ActionRowProps) {
  return (
    <View style={styles.container}>
      <AnimatedPressable onPress={onDeposit} haptic disabled={isLoading} style={styles.actionPill}>
        <View style={[styles.actionContent, styles.actionPillSurface]}>
          <Feather name="arrow-up-right" size={22} color={theme.colors.text} />
          <Text style={styles.actionText}>Income</Text>
        </View>
      </AnimatedPressable>

      <AnimatedPressable onPress={onSwap} style={styles.swapButton}>
        <View style={[styles.swapSurface, styles.actionContent]}>
          <Ionicons name="swap-vertical" size={28} color={theme.colors.text} />
        </View>
      </AnimatedPressable>

      <AnimatedPressable onPress={onWithdraw} haptic disabled={isLoading} style={styles.actionPill}>
        <View style={[styles.actionContent, styles.actionPillSurface]}>
          <Feather name="arrow-down-right" size={22} color={theme.colors.text} />
          <Text style={styles.actionText}>Expense</Text>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
    marginBottom: 18,
    paddingHorizontal: 22,
    gap: 12,
  },
  actionPill: {
    flex: 1,
    minWidth: 0,
  },
  animatedContent: {
    flex: 1,
  },
  actionPillSurface: {
    width: '100%',
    height: 54,
    backgroundColor: '#F0F0F0',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    maxWidth: '100%',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '400',
    color: theme.colors.text,
    letterSpacing: -0.3,
    maxWidth: '100%',
    includeFontPadding: false,
  },
  swapButton: {
    width: 54,
    height: 54,
  },
  swapSurface: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
