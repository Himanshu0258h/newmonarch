import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

import theme from '../theme';

type ActionRowProps = {
  onDeposit: () => void;
  onSwap: () => void;
  onWithdraw: () => void;
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
      toValue: 0.97,
      useNativeDriver: true,
      tension: 180,
      friction: 10,
    }).start();
  };

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
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.animatedContent, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function ActionRow({ onDeposit, onSwap, onWithdraw }: ActionRowProps) {
  return (
    <View style={styles.container}>
      <AnimatedPressable onPress={onDeposit} style={styles.actionPill}>
        <View style={[styles.actionContent, styles.actionPillSurface]}>
          <Feather name="arrow-up-right" size={22} color={theme.colors.text} />
          <Text style={styles.actionText}>Deposit</Text>
        </View>
      </AnimatedPressable>

      <AnimatedPressable onPress={onSwap} style={styles.swapButton}>
        <View style={[styles.swapSurface, styles.actionContent]}>
          <Ionicons name="swap-vertical" size={28} color={theme.colors.text} />
        </View>
      </AnimatedPressable>

      <AnimatedPressable onPress={onWithdraw} style={styles.actionPill}>
        <View style={[styles.actionContent, styles.actionPillSurface]}>
          <Feather name="arrow-down-right" size={22} color={theme.colors.text} />
          <Text style={styles.actionText}>Withdraw</Text>
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
