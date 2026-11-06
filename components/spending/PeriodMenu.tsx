import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../../theme';
import type { SpendingPeriod } from '../../hooks/useSpendingData';

const options: { label: string; value: SpendingPeriod }[] = [
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
];

type Props = {
  value: SpendingPeriod;
  onChange: (period: SpendingPeriod) => void;
};

export default function PeriodMenu({ value, onChange }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const anchorRef = React.useRef<ViewInstance | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [anchor, setAnchor] = React.useState({ x: 0, y: 0, width: 0, height: 0 });
  const progress = useSharedValue(0);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? 'Month';
  const popupStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.95 + progress.value * 0.05 }],
  }));

  const openMenu = React.useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setVisible(true);
      progress.value = 0;
      progress.value = withTiming(1, { duration: 150 });
    });
  }, [progress]);

  const closeMenu = React.useCallback(() => {
    progress.value = withTiming(0, { duration: 100 });
    setVisible(false);
  }, [progress]);

  const select = React.useCallback((next: SpendingPeriod) => {
    closeMenu();
    if (next !== value) {
      onChange(next);
      void Haptics.selectionAsync();
    }
  }, [closeMenu, onChange, value]);

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Spending period, ${selectedLabel}`}
          accessibilityState={{ expanded: visible }}
          onPress={visible ? closeMenu : openMenu}
          style={styles.pill}
        >
          <Text style={styles.pillText}>{selectedLabel}</Text>
          <Ionicons name="chevron-down" size={13} color="#0B1020" />
        </Pressable>
      </View>
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={closeMenu}
        statusBarTranslucent
      >
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            accessibilityLabel="Close period menu"
            onPress={closeMenu}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            style={[
              styles.menu,
              {
                top: anchor.y + anchor.height + 7,
                left: Math.min(
                  screenWidth - 120,
                  Math.max(8, anchor.x + anchor.width - 112),
                ),
              },
              popupStyle,
            ]}
          >
            {options.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected: option.value === value }}
                onPress={() => select(option.value)}
                style={styles.option}
              >
                <Text style={styles.optionText}>{option.label}</Text>
                {option.value === value ? (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                ) : null}
              </Pressable>
            ))}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 30,
    minWidth: 62,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  pillText: {
    color: '#0B1020',
    fontSize: 13,
    fontWeight: '600',
  },
  menu: {
    position: 'absolute',
    width: 112,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.spendingBorder,
    backgroundColor: '#151C30',
    zIndex: 999,
    elevation: 999,
  },
  option: {
    minHeight: 37,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
});
