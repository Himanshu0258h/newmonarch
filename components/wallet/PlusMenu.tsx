import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  visible: boolean;
  anchor: LayoutRectangle | null;
  onClose: () => void;
  onAddCard: () => void;
  onManageCards: () => void;
};

const MENU_WIDTH = 200;

export default function PlusMenu({
  visible,
  anchor,
  onClose,
  onAddCard,
  onManageCards,
}: Props) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const closing = React.useRef(false);
  const animationStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: reducedMotion ? 1 : 0.9 + progress.value * 0.1 }],
  }));
  const position = React.useMemo(() => {
    if (!anchor) return { left: 12, top: 12 };
    const left = Math.max(12, Math.min(width - MENU_WIDTH - 12, anchor.x + anchor.width - MENU_WIDTH));
    const proposedTop = anchor.y + anchor.height + 8;
    return { left, top: proposedTop + 112 > height ? Math.max(12, anchor.y - 112) : proposedTop };
  }, [anchor, height, width]);

  React.useEffect(() => {
    if (!visible) return;
    closing.current = false;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: reducedMotion ? 100 : 150,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reducedMotion, visible]);

  const close = React.useCallback((afterClose?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    progress.value = withTiming(0, { duration: reducedMotion ? 70 : 100 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
        if (afterClose) runOnJS(afterClose)();
      }
    });
  }, [onClose, progress, reducedMotion]);

  const choose = (callback: () => void) => {
    close(callback);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => close()}
    >
      <View style={styles.root}>
        <Pressable accessibilityLabel="Close menu" style={StyleSheet.absoluteFill} onPress={() => close()} />
        <Animated.View style={[styles.menu, position, animationStyle]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => choose(onAddCard)}
            style={styles.row}
          >
            <Ionicons name="card-outline" size={19} color="#24242A" />
            <Text style={styles.label}>Add new card</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            accessibilityRole="button"
            onPress={() => choose(onManageCards)}
            style={styles.row}
          >
            <Feather name="settings" size={18} color="#24242A" />
            <Text style={styles.label}>Manage cards</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    zIndex: 999,
    elevation: 999,
  },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 15,
  },
  label: {
    color: '#24242A',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    backgroundColor: '#E8E8EB',
  },
});
