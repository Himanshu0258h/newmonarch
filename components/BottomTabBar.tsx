import React from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export type TabId = 'card' | 'swap' | 'chart' | 'scan' | 'grid';

const TABS: readonly TabId[] = ['card', 'swap', 'chart', 'scan', 'grid'];
const ACTIVE_INDICATOR_SIZE = 48;
const BAR_HEIGHT = 60;

type BottomTabBarProps = {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
};

function AnimatedTabButton({
  onPress,
  onLayout,
  children,
}: {
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onLayout={onLayout}
      style={styles.tabButton}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.92, { duration: 90 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 16, stiffness: 220 });
      }}
    >
      <Animated.View style={[styles.tabButtonContent, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  const { width: screenWidth } = useWindowDimensions();
  const positions = React.useRef<Partial<Record<TabId, number>>>({});
  const indicatorX = useSharedValue(0);
  const indicatorScale = useSharedValue(1);
  const indicatorOpacity = useSharedValue(0);
  const horizontalMargin = Math.min(40, screenWidth * 0.08);
  const barWidth = Math.max(0, screenWidth - horizontalMargin * 2);
  const indicatorSize = Math.max(
    0,
    Math.min(ACTIVE_INDICATOR_SIZE, BAR_HEIGHT - 8, barWidth / TABS.length - 4),
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [{ translateX: indicatorX.value }, { scale: indicatorScale.value }],
  }));

  const setPosition = React.useCallback(
    (tab: TabId, event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      const targetX = x + (width - indicatorSize) / 2;
      positions.current[tab] = targetX;
      if (tab === activeTab) {
        indicatorX.value = targetX;
        indicatorOpacity.value = withTiming(1, { duration: 120 });
      }
    },
    [activeTab, indicatorOpacity, indicatorSize, indicatorX],
  );

  React.useEffect(() => {
    const targetX = positions.current[activeTab];
    if (targetX === undefined) return;
    indicatorScale.value = withSpring(1.06, { damping: 15, stiffness: 260 }, (finished) => {
      if (finished) indicatorScale.value = withSpring(1, { damping: 16, stiffness: 220 });
    });
    indicatorX.value = withSpring(targetX, { damping: 18, stiffness: 180 });
  }, [activeTab, barWidth, indicatorScale, indicatorSize, indicatorX]);

  const renderTabIcon = (tab: TabId) => {
    const isActive = activeTab === tab;
    const iconColor = isActive ? '#FFFFFF' : '#111111';

    switch (tab) {
      case 'card':
        return <Feather name="home" size={25} color={iconColor} />;
      case 'swap':
        return <Ionicons name="wallet-outline" size={25} color={iconColor} />;
      case 'chart':
        return <Ionicons name="pie-chart-outline" size={25} color={iconColor} />;
      case 'scan':
        return <Ionicons name="scan-outline" size={25} color={iconColor} />;
      case 'grid':
        return (
          <View style={styles.gridWrap}>
            {Array.from({ length: 4 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.gridDot,
                  { backgroundColor: iconColor, opacity: isActive ? 1 : 0.9 },
                ]}
              />
            ))}
          </View>
        );
    }
  };

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: barWidth,
          left: horizontalMargin,
          right: undefined,
        },
      ]}
    >
      <View style={styles.shadowWrapper}>
        <View style={styles.solidPill}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeIndicator,
              {
                top: (BAR_HEIGHT - indicatorSize) / 2,
                width: indicatorSize,
                height: indicatorSize,
                borderRadius: indicatorSize / 2,
              },
              indicatorStyle,
            ]}
          >
            <View />
          </Animated.View>
          <View style={styles.tabsRow}>
            {TABS.map((tab) => (
              <AnimatedTabButton
                key={tab}
                onLayout={(event) => setPosition(tab, event)}
                onPress={() => {
                  if (tab === activeTab) return;
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onTabChange(tab);
                }}
              >
                {renderTabIcon(tab)}
              </AnimatedTabButton>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 16,
    alignItems: 'center',
    zIndex: 3,
    elevation: 3,
  },
  shadowWrapper: {
    width: '100%',
    height: BAR_HEIGHT,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.01)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 5,
  },
  solidPill: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#F1F1F2',
    overflow: 'hidden',
  },
  tabsRow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 2,
  },
  tabButton: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    backgroundColor: '#111111',
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
  },
});
