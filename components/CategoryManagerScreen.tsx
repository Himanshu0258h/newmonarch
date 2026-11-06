import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  FadeInUp,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CategoryOption } from './CategoryPickerSheet';
import WalletBackground from './wallet/WalletBackground';
import theme from '../theme';
import type { TransactionMode } from '../utils/transactionCategories';

type CategoryStats = {
  count: number;
  monthlyAmount: number;
  formattedAmount: string;
  share: number;
};

const EMPTY_CATEGORY_STATS: Record<string, CategoryStats> = {};

type ListItem =
  | { kind: 'section'; id: string; label: string }
  | { kind: 'empty'; id: string }
  | { kind: 'category'; id: string; item: CategoryOption; index: number };

const LIST_HEADER_HEIGHT = 79;
const CATEGORY_ROW_HEIGHT = 80;
const CATEGORY_ROW_STEP = CATEGORY_ROW_HEIGHT + 6;
const SECTION_ROW_HEIGHT = 28;
const EMPTY_ROW_HEIGHT = 54;

type Props = {
  mode: TransactionMode;
  customCategories: CategoryOption[];
  builtinCategories: CategoryOption[];
  hiddenBuiltinIds: string[];
  stats: Record<string, CategoryStats>;
  categoryCount: number;
  amountsRevealed?: boolean;
  form: React.ReactNode;
  snackbar?: string;
  onUndo: () => void;
  onClose: () => void;
  onModeChange: (mode: TransactionMode) => void;
  onAdd: () => void;
  onEdit: (item: CategoryOption) => void;
  onDelete: (item: CategoryOption) => void;
  onToggleHidden: (item: CategoryOption) => void;
  onReorder: (type: CategoryOption['type'], startIndex: number, targetIndex: number) => void;
};

type CategoryRowProps = {
  item: CategoryOption;
  index: number;
  count: number;
  stat: CategoryStats;
  hidden: boolean;
  amountsRevealed: boolean;
  entranceIndex: number;
  scrollGesture: ReturnType<typeof Gesture.Native>;
  onEdit: (item: CategoryOption) => void;
  onDelete: (item: CategoryOption) => void;
  onToggleHidden: (item: CategoryOption) => void;
  onReorder: (type: CategoryOption['type'], startIndex: number, targetIndex: number) => void;
  onSwipeOpen: (id: string, close: () => void) => void;
};

function lightenColor(color: string) {
  const value = Number.parseInt(color.replace('#', ''), 16);
  if (!Number.isFinite(value)) return color;
  const red = Math.min(255, ((value >> 16) & 255) + 32);
  const green = Math.min(255, ((value >> 8) & 255) + 32);
  const blue = Math.min(255, (value & 255) + 32);
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

const CategoryRow = React.memo(function CategoryRow({
  item,
  index,
  count,
  stat,
  hidden,
  amountsRevealed,
  entranceIndex,
  scrollGesture,
  onEdit,
  onDelete,
  onToggleHidden,
  onReorder,
  onSwipeOpen,
}: CategoryRowProps) {
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(0);
  const swipeRef = React.useRef<React.ComponentRef<typeof Swipeable>>(null);
  const targetIndex = useSharedValue(index);
  const previousTarget = useSharedValue(index);
  const didDrop = useSharedValue(false);
  const isDragging = useSharedValue(0);
  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: interpolate(isDragging.value, [0, 1], [1, 1.03]) },
    ],
    zIndex: isDragging.value > 0.5 ? 5 : 0,
  }));
  const dragGesture = React.useMemo(
    () => Gesture.Pan()
      .activateAfterLongPress(650)
      .shouldCancelWhenOutside(false)
      .blocksExternalGesture(scrollGesture)
      .onStart(() => {
        didDrop.value = false;
        isDragging.value = withSpring(1, { damping: 18, stiffness: 220 });
        targetIndex.value = index;
        previousTarget.value = index;
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      })
      .onUpdate((event) => {
        translateY.value = event.translationY;
        const nextIndex = Math.max(
          0,
          Math.min(count - 1, index + Math.round(event.translationY / CATEGORY_ROW_STEP)),
        );
        if (nextIndex !== targetIndex.value) {
          targetIndex.value = nextIndex;
          if (nextIndex !== previousTarget.value) {
            previousTarget.value = nextIndex;
            runOnJS(Haptics.selectionAsync)();
          }
        }
      })
      .onEnd(() => {
        didDrop.value = true;
        isDragging.value = withSpring(0, { damping: 18, stiffness: 220 });
        translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
        if (targetIndex.value !== index) {
          runOnJS(onReorder)(item.type, index, targetIndex.value);
        }
      })
      .onFinalize(() => {
        if (!didDrop.value) {
          isDragging.value = withSpring(0, { damping: 18, stiffness: 220 });
          translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
        }
      }),
    [count, didDrop, index, isDragging, item.type, onReorder, previousTarget, scrollGesture, targetIndex, translateY],
  );
  const rowEntrance = Platform.OS === 'android'
    ? undefined
    : reducedMotion
      ? FadeIn.duration(160)
      : entranceIndex < 4
      ? FadeInUp.delay(entranceIndex * 35).duration(280)
      : undefined;
  const rowExit = Platform.OS === 'android' ? undefined : FadeOut.duration(180);
  const actions = (
    <View style={styles.swipeActions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${item.label}`}
        onPress={() => {
          swipeRef.current?.close();
          onEdit(item);
        }}
        style={[styles.swipeAction, styles.editAction, item.type === 'builtin' && styles.builtinEditAction]}
      >
        <Feather name="edit-2" size={17} color="#FFFFFF" />
        <Text style={styles.swipeActionText}>Edit</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.type === 'custom' ? `Delete ${item.label}` : `${hidden ? 'Show' : 'Hide'} ${item.label}`}
        onPress={() => {
          swipeRef.current?.close();
          if (item.type === 'custom') onDelete(item);
          else onToggleHidden(item);
        }}
        style={[
          styles.swipeAction,
          item.type === 'custom' || !hidden ? styles.deleteAction : styles.showAction,
        ]}
      >
        <Ionicons
          name={item.type === 'custom' ? 'trash-outline' : hidden ? 'eye-outline' : 'eye-off-outline'}
          size={18}
          color="#FFFFFF"
        />
        <Text style={styles.swipeActionText}>
          {item.type === 'custom' ? 'Delete' : hidden ? 'Show' : 'Hide'}
        </Text>
      </Pressable>
    </View>
  );

  const handleAccessibilityAction = (event: { nativeEvent: { actionName: string } }) => {
    const action = event.nativeEvent.actionName;
    if (action === 'edit') onEdit(item);
    if (action === 'delete' && item.type === 'custom') onDelete(item);
    if (action === 'move-up' && index > 0) onReorder(item.type, index, index - 1);
    if (action === 'move-down' && index < count - 1) onReorder(item.type, index, index + 1);
  };
  const statsLabel = stat.count
    ? `${stat.count} transactions · ${amountsRevealed ? stat.formattedAmount : '₹ ••••'} this month`
    : 'No transactions yet';

  return (
    <Animated.View
      entering={rowEntrance}
      exiting={rowExit}
      style={[styles.rowAnimationWrap, hidden && styles.hiddenRow]}
    >
      <Swipeable
        ref={swipeRef}
        renderRightActions={() => actions}
        rightThreshold={64}
        friction={1.6}
        overshootRight={false}
        onSwipeableOpen={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSwipeOpen(item.id, () => swipeRef.current?.close());
        }}
      >
        <Animated.View style={[styles.categoryRow, rowAnimatedStyle]}>
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${item.label}, ${stat.count} transactions`}
            accessibilityActions={[
              { name: 'edit', label: 'Edit' },
              ...(item.type === 'custom' ? [{ name: 'delete', label: 'Delete' }] : []),
              { name: 'move-up', label: 'Move up' },
              { name: 'move-down', label: 'Move down' },
            ]}
            onAccessibilityAction={handleAccessibilityAction}
            onPress={() => onEdit(item)}
            style={styles.categoryRowContent}
          >
              <View style={[styles.categoryBadge, { shadowColor: item.color }]}>
                <LinearGradient
                  colors={[lightenColor(item.color), item.color]}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                {item.icon ? (
                  <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={26} color="#FFFFFF" />
                ) : (
                  <Text style={styles.categoryInitial}>{item.label.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.categoryDetails}>
                <View style={styles.categoryNameLine}>
                  <Text numberOfLines={1} style={styles.categoryName}>{item.label}</Text>
                  {item.type === 'builtin' ? <Ionicons name="lock-closed" size={12} color="#92919A" /> : null}
                  {hidden ? <Text style={styles.hiddenTag}>Hidden</Text> : null}
                </View>
                <Text numberOfLines={1} style={styles.categoryMeta}>{statsLabel}</Text>
                <View style={styles.usageTrack}>
                  <View
                    style={[
                      styles.usageFill,
                      { width: `${Math.min(1, Math.max(0, stat.share)) * 100}%`, backgroundColor: `${item.color}59` },
                    ]}
                  />
                </View>
              </View>
            <GestureDetector gesture={dragGesture}>
              <View
                accessible
                accessibilityRole="button"
                accessibilityLabel={`Hold to reorder ${item.label}`}
                style={styles.dragHandle}
              >
                <Ionicons name="reorder-three-outline" size={24} color="#92919A" />
              </View>
            </GestureDetector>
          </Pressable>
        </Animated.View>
      </Swipeable>
    </Animated.View>
  );
});

export default function CategoryManagerScreen({
  mode,
  customCategories,
  builtinCategories,
  hiddenBuiltinIds,
  stats,
  categoryCount,
  amountsRevealed = false,
  form,
  snackbar,
  onUndo,
  onClose,
  onModeChange,
  onAdd,
  onEdit,
  onDelete,
  onToggleHidden,
  onReorder,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollY = useSharedValue(0);
  const scrollGesture = React.useMemo(() => Gesture.Native(), []);
  const activeSwipe = React.useRef<{ id: string; close: () => void } | null>(null);
  const segmentOffset = useSharedValue(mode === 'income' ? 1 : 0);
  const segmentWidth = useSharedValue(Math.max(0, (width - 46) / 2));
  const accent = theme.colors.categoryAccent;

  React.useEffect(() => {
    segmentOffset.value = withSpring(mode === 'income' ? 1 : 0, { damping: 20, stiffness: 180 });
  }, [mode, segmentOffset]);
  React.useEffect(() => {
    segmentWidth.value = Math.max(0, (width - 46) / 2);
  }, [segmentWidth, width]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const headerTitleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.value, [0, 80], [1, 0.8], 'clamp') }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 80], [1, 0], 'clamp'),
  }));
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: segmentOffset.value * segmentWidth.value }],
  }));
  const sheetTop = Math.max(insets.top + 180, height * 0.34);
  const sectionRows: ListItem[] = React.useMemo(() => {
    const rows: ListItem[] = [{ kind: 'section', id: 'your-categories', label: 'YOUR CATEGORIES' }];
    if (customCategories.length) {
      rows.push(...customCategories.map((item, index) => ({ kind: 'category' as const, id: item.id, item, index })));
    } else {
      rows.push({ kind: 'empty', id: 'empty-custom' });
    }
    if (builtinCategories.length) {
      rows.push({ kind: 'section', id: 'built-in', label: 'BUILT-IN' });
      rows.push(...builtinCategories.map((item, index) => ({ kind: 'category' as const, id: item.id, item, index })));
    }
    return rows;
  }, [builtinCategories, customCategories]);
  const itemLayouts = React.useMemo(() => {
    let offset = LIST_HEADER_HEIGHT;
    return sectionRows.map((item, index) => {
      const length = item.kind === 'category'
        ? CATEGORY_ROW_STEP
        : item.kind === 'section'
          ? SECTION_ROW_HEIGHT
          : EMPTY_ROW_HEIGHT;
      const layout = { length, offset, index };
      offset += length;
      return layout;
    });
  }, [sectionRows]);
  const handleModeChange = React.useCallback((nextMode: TransactionMode) => {
    if (nextMode === mode) return;
    void Haptics.selectionAsync();
    segmentOffset.value = withSpring(nextMode === 'income' ? 1 : 0, { damping: 20, stiffness: 180 });
    onModeChange(nextMode);
  }, [mode, onModeChange, segmentOffset]);
  const segmentSwipe = React.useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-18, 18])
      .failOffsetY([-12, 12])
      .onEnd((event) => {
        if (event.translationX < 0) runOnJS(handleModeChange)('income');
        else runOnJS(handleModeChange)('expense');
      }),
    [handleModeChange],
  );
  const handleSegmentLayout = React.useCallback((event: { nativeEvent: { layout: { width: number } } }) => {
    segmentWidth.value = Math.max(0, (event.nativeEvent.layout.width - 6) / 2);
  }, [segmentWidth]);

  const closeActiveSwipe = React.useCallback(() => {
    activeSwipe.current?.close();
    activeSwipe.current = null;
  }, []);
  const rowOpened = React.useCallback((id: string, close: () => void) => {
    if (activeSwipe.current?.id !== id) activeSwipe.current?.close();
    activeSwipe.current = { id, close };
  }, []);

  const getItemLayout = React.useCallback(
    (_: ArrayLike<ListItem> | null | undefined, index: number) => (
      itemLayouts[index] ?? { length: 0, offset: LIST_HEADER_HEIGHT, index }
    ),
    [itemLayouts],
  );
  const handleAddCategory = React.useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd();
  }, [onAdd]);
  const listHeader = React.useMemo(() => (
    <Pressable
      accessibilityRole="button"
      onPress={handleAddCategory}
      style={({ pressed }) => [styles.newCategoryButton, pressed && styles.newCategoryPressed]}
    >
      <Feather name="plus" size={20} color={accent} />
      <Text style={styles.newCategoryText}>New category</Text>
    </Pressable>
  ), [accent, handleAddCategory]);
  const renderItem = React.useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'section') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{item.label}</Text>
        </View>
      );
    }
    if (item.kind === 'empty') {
      return (
        <Text style={styles.emptyHint}>
          Create your own categories for things that matter to you
        </Text>
      );
    }
    return (
      <CategoryRow
        item={item.item}
        index={item.index}
        count={item.item.type === 'custom' ? customCategories.length : builtinCategories.length}
        entranceIndex={item.item.type === 'custom' ? item.index : customCategories.length + item.index}
        stat={stats[item.item.id] ?? { count: 0, monthlyAmount: 0, formattedAmount: '₹0.00', share: 0 }}
        hidden={hiddenBuiltinIds.includes(item.item.id)}
        amountsRevealed={amountsRevealed}
        scrollGesture={scrollGesture}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleHidden={onToggleHidden}
        onReorder={onReorder}
        onSwipeOpen={rowOpened}
      />
    );
  }, [
    accent,
    amountsRevealed,
    builtinCategories.length,
    customCategories.length,
    hiddenBuiltinIds,
    onDelete,
    onEdit,
    onReorder,
    onToggleHidden,
    rowOpened,
    scrollGesture,
    stats,
  ]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <NavigationBar style="light" />
      <WalletBackground variant="compact" scrollY={scrollY} />

      <View style={[styles.header, { height: sheetTop + 24, paddingTop: insets.top + 10 }]}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.headerTopRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to expense" onPress={onClose} style={styles.glassButton}>
            <Feather name="arrow-left" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerTitleWrap}>
            <Animated.Text style={[styles.title, headerTitleStyle]}>Categories</Animated.Text>
            <Animated.Text style={[styles.subtitle, subtitleStyle]}>
              {categoryCount} categories · Hold and drag to reorder
            </Animated.Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add category"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onAdd();
            }}
            style={styles.glassButton}
          >
            <Feather name="plus" size={20} color="#FFFFFF" />
          </Pressable>
        </Animated.View>
      </View>

      <View style={[styles.sheet, { top: sheetTop - 24, paddingBottom: insets.bottom + 24 }]}>
        <GestureDetector gesture={segmentSwipe}>
          <View onLayout={handleSegmentLayout} style={styles.segmented}>
            <Animated.View
              style={[
                styles.segmentIndicator,
                mode === 'income' ? styles.segmentIndicatorIncome : styles.segmentIndicatorExpense,
                indicatorStyle,
                { width: segmentWidth },
              ]}
            />
            {(['expense', 'income'] as const).map((nextMode) => {
              const selected = mode === nextMode;
              return (
                <Pressable
                  key={nextMode}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => handleModeChange(nextMode)}
                  style={styles.segmentButton}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      selected && styles.segmentTextSelected,
                      selected && (nextMode === 'income'
                        ? styles.segmentTextIncome
                        : styles.segmentTextExpense),
                    ]}
                  >
                    {nextMode === 'expense' ? 'Expense' : 'Income'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GestureDetector>

        <GestureDetector gesture={scrollGesture}>
          <Animated.FlatList
            data={sectionRows}
            keyExtractor={(item) => item.id}
            getItemLayout={getItemLayout}
            initialNumToRender={5}
            maxToRenderPerBatch={4}
            updateCellsBatchingPeriod={40}
            windowSize={3}
            removeClippedSubviews
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            onScrollBeginDrag={closeActiveSwipe}
            onMomentumScrollBegin={closeActiveSwipe}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={listHeader}
            renderItem={renderItem}
          />
        </GestureDetector>
      </View>

      {snackbar ? (
        <View style={[styles.snackbar, { bottom: insets.bottom + 12 }]}>
          <Text style={styles.snackbarText}>{snackbar}</Text>
          <Pressable accessibilityRole="button" onPress={onUndo} style={styles.undoButton}>
            <Text style={styles.undoText}>Undo</Text>
          </Pressable>
        </View>
      ) : null}
      {form}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.warmSheet,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    paddingHorizontal: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  glassButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginTop: 3,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: theme.colors.warmSheet,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    shadowColor: '#160500',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
  segmented: {
    height: 40,
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 3,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 18,
  },
  segmentIndicatorExpense: {
    backgroundColor: '#FFF0EB',
  },
  segmentIndicatorIncome: {
    backgroundColor: '#E8F7F0',
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    color: '#70463B',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextSelected: {
    color: '#21120E',
  },
  segmentTextExpense: {
    color: '#A8442E',
  },
  segmentTextIncome: {
    color: '#167A55',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  newCategoryButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 5,
    marginBottom: 18,
    borderRadius: 28,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.categoryAccent,
    backgroundColor: theme.colors.categoryAccentTint,
  },
  newCategoryPressed: {
    transform: [{ scale: 0.98 }],
  },
  newCategoryText: {
    color: theme.colors.categoryAccent,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionHeader: {
    height: SECTION_ROW_HEIGHT,
    justifyContent: 'center',
    backgroundColor: theme.colors.warmSheet,
  },
  sectionTitle: {
    color: '#85818A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  emptyHint: {
    minHeight: 54,
    paddingTop: 10,
    paddingBottom: 12,
    color: '#85818A',
    fontSize: 13,
    lineHeight: 19,
  },
  rowAnimationWrap: {
    marginBottom: CATEGORY_ROW_STEP - CATEGORY_ROW_HEIGHT,
  },
  hiddenRow: {
    opacity: 0.5,
  },
  categoryRow: {
    minHeight: CATEGORY_ROW_HEIGHT,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1C1412',
    shadowOpacity: 0.045,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  categoryRowContent: {
    minHeight: CATEGORY_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 11,
  },
  categoryBadge: {
    width: 46,
    height: 46,
    overflow: 'hidden',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  categoryInitial: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '700',
  },
  categoryDetails: {
    flex: 1,
    minWidth: 0,
  },
  categoryNameLine: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryName: {
    flexShrink: 1,
    color: '#111111',
    fontSize: 16,
    fontWeight: '600',
  },
  categoryMeta: {
    marginTop: 3,
    color: '#88858E',
    fontSize: 12,
  },
  hiddenTag: {
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    color: '#7C5960',
    backgroundColor: '#F6E5E5',
    fontSize: 9,
    fontWeight: '700',
  },
  usageTrack: {
    height: 3,
    overflow: 'hidden',
    marginTop: 6,
    borderRadius: 2,
    backgroundColor: '#F1EEF0',
  },
  usageFill: {
    width: '100%',
    height: '100%',
    alignSelf: 'flex-start',
  },
  dragHandle: {
    width: 28,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  swipeActions: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
    borderRadius: 24,
    backgroundColor: '#F3E8E3',
  },
  swipeAction: {
    width: 64,
    minWidth: 64,
    height: 66,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  editAction: {
    backgroundColor: theme.colors.categoryAccent,
  },
  builtinEditAction: {
    backgroundColor: '#8C7772',
  },
  deleteAction: {
    backgroundColor: theme.colors.deleteAccent,
  },
  showAction: {
    backgroundColor: '#6E9A76',
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  snackbar: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#24140F',
    zIndex: 8,
    elevation: 8,
  },
  snackbarText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  undoButton: {
    paddingVertical: 10,
    paddingLeft: 14,
  },
  undoText: {
    color: '#FFB59C',
    fontSize: 14,
    fontWeight: '700',
  },
});
