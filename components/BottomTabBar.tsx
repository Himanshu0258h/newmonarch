import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';

import theme from '../theme';

export type TabId = 'card' | 'swap' | 'chart' | 'scan' | 'grid';

type BottomTabBarProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
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
    <Pressable
      style={style}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.tabButtonContent, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const renderTabIcon = (tab: TabId) => {
    const isActive = activeTab === tab;
    const color = isActive ? theme.colors.white : theme.colors.text;

    switch (tab) {
      case 'card':
        return <Feather name="credit-card" size={25} color={color} />;
      case 'swap':
        return <Ionicons name="swap-vertical-outline" size={25} color={color} />;
      case 'chart':
        return <Ionicons name="pie-chart-outline" size={25} color={color} />;
      case 'scan':
        return <Ionicons name="scan-outline" size={25} color={color} />;
      case 'grid':
        return (
          <View style={styles.gridWrap}>
            {Array.from({ length: 4 }).map((_, index) => (
              <View
                key={index}
                style={[styles.gridDot, isActive && styles.activeGridDot]}
              />
            ))}
          </View>
        );
    }
  };

  const renderTabButton = (tab: TabId) => {
    const isActive = activeTab === tab;

    return (
      <AnimatedPressable
        key={tab}
        onPress={() => onTabChange(tab)}
        style={styles.tabButton}
      >
        {isActive ? (
          <View style={styles.activeCircle}>{renderTabIcon(tab)}</View>
        ) : (
          renderTabIcon(tab)
        )}
      </AnimatedPressable>
    );
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.tabBar}>
        {(['card', 'swap', 'chart', 'scan', 'grid'] as const).map(renderTabButton)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 40,
    right: 40,
    bottom: 16,
    alignItems: 'center',
    zIndex: 3,
    elevation: 3,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
    height: 60,
    backgroundColor: '#F1F1F2',
    borderRadius: 999,
    paddingHorizontal: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 10,
  },
  tabButton: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabButtonContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCircle: {
    width: 48,
    height: 48,
    backgroundColor: '#111111',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridWrap: {
    width: 23,
    height: 23,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  gridDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.text,
    opacity: 0.9,
  },
  activeGridDot: {
    backgroundColor: theme.colors.white,
    opacity: 1,
  },
});
