import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CategoryManagerScreen from './CategoryManagerScreen';
import { formatWalletCurrency, useWalletCards } from '../context/WalletCardsContext';
import { transactionTimestamp } from '../data/transactions';
import { theme } from '../theme';
import {
  getTransactionMode,
  TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORY_COLORS as categoryColorMap,
  TRANSACTION_CATEGORY_OVERRIDES_KEY,
  TRANSACTION_CATEGORIES_STORAGE_KEY,
  type TransactionMode,
} from '../utils/transactionCategories';

export type CategoryOption = {
  id: string;
  name: string;
  label: string;
  color: string;
  icon: string;
  type: 'builtin' | 'custom';
  mode?: TransactionMode;
  monthlyBudget?: number;
};

type Props = {
  visible: boolean;
  inline?: boolean;
  mode: TransactionMode;
  selectedCategoryName?: string;
  onManagerOverlayChange?: (overlay: React.ReactNode | null, revision: string) => void;
  onSelect: (categoryName: string) => void;
  onClose: () => void;
};

const STORAGE_KEY = TRANSACTION_CATEGORIES_STORAGE_KEY;
const CATEGORY_ORDER_KEY = 'transaction-category-order-v1';
const BUILTIN_OVERRIDES_KEY = TRANSACTION_CATEGORY_OVERRIDES_KEY;
const HIDDEN_BUILTINS_KEY = 'hidden-transaction-categories-v1';
const MANAGER_ROW_HEIGHT = 66;
const MANAGER_ROW_GAP = 8;
const MANAGER_ROW_STEP = MANAGER_ROW_HEIGHT + MANAGER_ROW_GAP;
const EMPTY_CATEGORY_STATS: Record<string, {
  count: number;
  monthlyAmount: number;
  formattedAmount: string;
  share: number;
}> = {};
type ActiveCategoryDrag = {
  categoryId: string;
  startIndex: number;
  targetIndex: number;
};

type BuiltinCategoryOverride = {
  name: string;
  color: string;
  icon: string;
  monthlyBudget?: number;
};
const SWATCHES = [...new Set([
  '#22C55E', '#10B981', '#6B7280', '#3B4BF0', '#EF4444', '#F59E0B', '#65D31A', '#F59E0B',
  '#64748B', '#475569', '#F97316', '#06B6D4', '#8B2FC9', '#6D28D9', '#EC4899', '#14B8A6',
  '#3B82F6', '#0EA5E9', '#22C55E', '#F59E0B', '#8B5CF6', '#E11D48', '#14B8A6', '#0EA5E9',
])];
const CATEGORY_SYMBOLS: Array<keyof typeof Ionicons.glyphMap> = [
  'pricetag-outline',
  'restaurant-outline',
  'basket-outline',
  'train-outline',
  'car-outline',
  'bag-outline',
  'receipt-outline',
  'home-outline',
  'film-outline',
  'medkit-outline',
  'school-outline',
  'airplane-outline',
  'repeat-outline',
  'briefcase-outline',
  'laptop-outline',
  'business-outline',
  'trending-up-outline',
  'return-down-back-outline',
  'gift-outline',
  'cash-outline',
  'heart-outline',
  'paw-outline',
  'cafe-outline',
  'shirt-outline',
  'bulb-outline',
  'wifi-outline',
];

const displayLabelMap: Record<string, string> = {
  'Food and dining': 'Food & Drinks',
  'Bills and utilities': 'Bills',
  'Rent': 'House Rent',
  'Transfers': 'Transfer',
  'Travel': 'Travel',
  'Investments': 'Investment',
  'Other': 'Other',
  'Entertainment': 'Entertainment',
  'Groceries': 'Groceries',
  'Fuel': 'Fuel',
  'Health': 'Health',
  'Shopping': 'Shopping',
  'Education': 'Education',
  'Salary': 'Salary',
  'Freelance': 'Freelance',
  'Business': 'Business',
  'Gift': 'Gift',
  'Interest': 'Interest',
  'Refund': 'Refund',
  'EMI': 'EMI',
  'Transfer': 'Transfer',
  'House Rent': 'House Rent',
};

function labelForCategoryName(name: string) {
  return displayLabelMap[name] ?? name;
}

function getCategoryDetailsForName(mode: TransactionMode, name?: string) {
  const builtin = TRANSACTION_CATEGORIES[mode].find((item) => item.name === name);
  if (builtin) {
    return {
      id: `builtin-${mode}-${builtin.name}`,
      name: builtin.name,
      label: labelForCategoryName(builtin.name),
      color: categoryColorMap[builtin.name] ?? '#475569',
      icon: builtin.icon,
      type: 'builtin' as const,
    };
  }
  return {
    id: `fallback-${name ?? 'other'}`,
    name: name ?? 'Other',
    label: name ?? 'Other',
    color: '#475569',
    icon: 'pricetag-outline',
    type: 'custom' as const,
  };
}

type CategoryEditorDraft = {
  name: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  monthlyBudget: string;
};

type CategoryManagerEditorProps = {
  bottomInset: number;
  categoryId: string | null;
  isBuiltin: boolean;
  mode: TransactionMode;
  initialName: string;
  initialColor: string;
  initialIcon: keyof typeof Ionicons.glyphMap;
  initialBudget: string;
  accent: string;
  swatches: string[];
  usedColors: string[];
  iconSize: number;
  error: string;
  onClose: () => void;
  onSave: (draft: CategoryEditorDraft) => void;
};

type CategoryIconOptionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  accent: string;
  size: number;
  onSelect: (icon: keyof typeof Ionicons.glyphMap) => void;
};

const CategoryIconOption = React.memo(function CategoryIconOption({
  icon,
  selected,
  accent,
  size,
  onSelect,
}: CategoryIconOptionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Select ${icon.replace('-outline', '').replace(/-/g, ' ')} icon`}
      accessibilityState={{ selected }}
      onPress={() => onSelect(icon)}
      style={[
        styles.iconGridOption,
        { width: size, height: size },
        selected && { borderColor: accent, backgroundColor: `${accent}14` },
      ]}
    >
      <Ionicons name={icon} size={21} color={selected ? accent : '#555D6B'} />
    </Pressable>
  );
});

function CategoryManagerEditor({
  bottomInset,
  categoryId,
  isBuiltin,
  mode,
  initialName,
  initialColor,
  initialIcon,
  initialBudget,
  accent,
  swatches,
  usedColors,
  iconSize,
  error,
  onClose,
  onSave,
}: CategoryManagerEditorProps) {
  const nameRef = React.useRef(initialName);
  const budgetRef = React.useRef(initialBudget);
  const [color, setColor] = React.useState(initialColor);
  const [icon, setIcon] = React.useState(initialIcon);
  const selectIcon = React.useCallback((nextIcon: keyof typeof Ionicons.glyphMap) => {
    setIcon(nextIcon);
  }, []);
  const colorInUse = React.useCallback((candidate: string) => (
    usedColors.some((used) => used.toLowerCase() === candidate.toLowerCase())
  ), [usedColors]);

  return (
    <View pointerEvents="box-none" style={styles.editOverlay}>
      <View style={[styles.editCard, { paddingBottom: bottomInset + 24 }]}>
        <View style={styles.editCardHeader}>
          <View style={styles.managerPreview}>
            <LinearGradient
              colors={[`${color}CC`, color]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name={icon} size={38} color="#FFFFFF" />
          </View>
          <View style={styles.managerTitleWrap}>
            <Text style={styles.managerFormTitle}>{categoryId ? 'Edit category' : 'New category'}</Text>
            <Text style={styles.managerSubtitle}>
              {isBuiltin ? 'Built-in names and icons stay locked.' : 'Choose a name, icon, and color.'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close category form"
            onPress={onClose}
            style={styles.managerActionButton}
          >
            <Feather name="x" size={18} color="#586071" />
          </Pressable>
        </View>
        <TextInput
          accessibilityLabel="Category name"
          defaultValue={initialName}
          editable={!isBuiltin}
          onChangeText={(value) => { nameRef.current = value.slice(0, 20); }}
          placeholder="Category name"
          placeholderTextColor="#8A8D96"
          style={[styles.editNameInput, isBuiltin && styles.lockedNameInput]}
          maxLength={20}
          returnKeyType="done"
        />
        {mode === 'expense' ? (
          <>
            <Text style={styles.managerFieldLabel}>MONTHLY BUDGET</Text>
            <View style={styles.budgetInputWrap}>
              <Text style={styles.budgetCurrency}>₹</Text>
              <TextInput
                accessibilityLabel="Monthly category budget in rupees"
                defaultValue={initialBudget}
                onChangeText={(value) => {
                  const cleaned = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
                  const [integerPart, ...fractionParts] = cleaned.split('.');
                  budgetRef.current = fractionParts.length
                    ? `${integerPart}.${fractionParts.join('').slice(0, 2)}`
                    : integerPart;
                }}
                placeholder="No limit"
                placeholderTextColor="#8A8D96"
                keyboardType="decimal-pad"
                maxLength={14}
                style={styles.budgetInput}
              />
            </View>
            <Text style={styles.budgetHint}>Optional · resets each month</Text>
          </>
        ) : null}
        {!isBuiltin ? (
          <>
            <Text style={styles.managerFieldLabel}>ICON</Text>
            <View style={styles.iconGrid}>
              {CATEGORY_SYMBOLS.slice(0, 24).map((symbol) => {
                return (
                  <CategoryIconOption
                    key={symbol}
                    icon={symbol}
                    selected={icon === symbol}
                    accent={accent}
                    size={iconSize}
                    onSelect={selectIcon}
                  />
                );
              })}
            </View>
          </>
        ) : null}
        <Text style={styles.managerFieldLabel}>COLOR</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.managerSwatches}>
          {swatches.map((swatch) => {
            const used = colorInUse(swatch);
            return (
              <Pressable
                key={swatch}
                accessibilityRole="button"
                accessibilityLabel={used ? `${swatch}, already used` : `Choose color ${swatch}`}
                accessibilityState={{ selected: color === swatch, disabled: used }}
                disabled={used}
                onPress={() => setColor(swatch)}
                style={[
                  styles.swatch,
                  styles.formSwatch,
                  { backgroundColor: swatch },
                  used && styles.swatchUnavailable,
                  color === swatch && [styles.formSwatchSelected, { borderColor: accent }],
                ]}
              />
            );
          })}
        </ScrollView>
        {error ? <Text style={styles.managerError}>{error}</Text> : null}
        <View style={styles.managerFormActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSave({
              name: nameRef.current,
              color,
              icon,
              monthlyBudget: budgetRef.current,
            })}
            style={[styles.managerSaveButton, { backgroundColor: accent }]}
          >
            <Text style={styles.managerSaveText}>{categoryId ? 'Save changes' : 'Create category'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const sortLabel = (left: CategoryOption, right: CategoryOption) =>
  left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });

function CategoryManagerRow({
  item,
  index,
  itemCount,
  isSelected,
  accent,
  activeDrag,
  scrollGesture,
  onSelect,
  onEdit,
  onDelete,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  item: CategoryOption;
  index: number;
  itemCount: number;
  isSelected: boolean;
  accent: string;
  activeDrag: ActiveCategoryDrag | null;
  scrollGesture: ReturnType<typeof Gesture.Native>;
  onSelect: (item: CategoryOption) => void;
  onEdit: (item: CategoryOption) => void;
  onDelete: (item: CategoryOption) => void;
  onDragStart: (categoryId: string, startIndex: number) => void;
  onDragMove: (categoryId: string, startIndex: number, targetIndex: number) => void;
  onDragEnd: (categoryId: string, startIndex: number, targetIndex: number) => void;
  onDragCancel: () => void;
}) {
  const translateY = useSharedValue(0);
  const targetIndexValue = useSharedValue(index);
  const didDrop = useSharedValue(false);
  const dragTargetIndex = activeDrag?.targetIndex ?? index;
  const shift = activeDrag && activeDrag.categoryId !== item.id
    ? activeDrag.startIndex < dragTargetIndex &&
      index > activeDrag.startIndex &&
      index <= dragTargetIndex
      ? -MANAGER_ROW_STEP
      : activeDrag.startIndex > dragTargetIndex &&
          index >= dragTargetIndex &&
          index < activeDrag.startIndex
        ? MANAGER_ROW_STEP
        : 0
    : 0;
  const isDragging = activeDrag?.categoryId === item.id;
  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: isDragging
          ? translateY.value
          : withSpring(shift, { damping: 22, stiffness: 220 }),
      },
    ],
  }), [isDragging, shift]);
  const dragGesture = React.useMemo(
    () => Gesture.Pan()
      .activateAfterLongPress(2000)
      .shouldCancelWhenOutside(false)
      .blocksExternalGesture(scrollGesture)
      .onStart(() => {
        didDrop.value = false;
        targetIndexValue.value = index;
        runOnJS(onDragStart)(item.id, index);
      })
      .onUpdate((event) => {
        translateY.value = event.translationY;
        const targetIndex = Math.max(
          0,
          Math.min(itemCount - 1, index + Math.round(event.translationY / MANAGER_ROW_STEP)),
        );
        if (targetIndex !== targetIndexValue.value) {
          targetIndexValue.value = targetIndex;
          runOnJS(onDragMove)(item.id, index, targetIndex);
        }
      })
      .onEnd(() => {
        didDrop.value = true;
        translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
        runOnJS(onDragEnd)(item.id, index, targetIndexValue.value);
      })
      .onFinalize(() => {
        if (!didDrop.value) {
          translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
          runOnJS(onDragCancel)();
        }
      }),
    [
      didDrop,
      index,
      item.id,
      itemCount,
      onDragCancel,
      onDragEnd,
      onDragMove,
      onDragStart,
      scrollGesture,
      targetIndexValue,
      translateY,
    ],
  );

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View
        style={[
          styles.managerCategoryRow,
          activeDrag && !isDragging && styles.managerFadedRow,
          isSelected && { borderColor: `${accent}70` },
          isDragging && [
            styles.managerDraggingRow,
            {
              shadowColor: '#000000',
            },
          ],
          rowAnimatedStyle,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Select ${item.label}`}
          accessibilityState={{ selected: isSelected }}
          onPress={() => onSelect(item)}
          style={styles.managerCategorySelect}
        >
          <View style={[styles.managerCategoryIcon, { backgroundColor: `${item.color}18` }]}>
            <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={20} color={item.color} />
          </View>
          <View style={styles.managerCategoryInfo}>
            <Text numberOfLines={1} style={styles.managerCategoryName}>{item.label}</Text>
            <Text style={styles.managerCategoryType}>
              {item.type === 'custom' ? 'Custom category' : 'Built-in'}
            </Text>
          </View>
        </Pressable>
        <View style={styles.managerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.label}`}
            onPress={() => onEdit(item)}
            style={styles.managerActionButton}
          >
            <Feather name="edit-2" size={16} color="#586071" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.label}`}
            onPress={() => onDelete(item)}
            style={styles.managerActionButton}
          >
            <Feather name="trash-2" size={16} color="#C93C32" />
          </Pressable>
        </View>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Hold anywhere on this category card for two seconds to reorder ${item.label}`}
          style={styles.managerDragHandle}
        >
          <Feather name="menu" size={18} color={isDragging ? accent : '#797982'} />
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function CategoryPickerSheet({
  visible,
  inline = false,
  mode,
  selectedCategoryName,
  onManagerOverlayChange,
  onSelect,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { transactions } = useWalletCards();
  const isExpensePicker = mode === 'expense';
  const isCompactPicker = inline || isExpensePicker;
  const accent = mode === 'income' ? '#16A878' : '#E95738';
  const heroColors = mode === 'income'
    ? ['#073B32', '#087B5A', '#16A878'] as const
    : ['#662118', '#B83C25', '#F05A3A'] as const;
  const translateY = useSharedValue(height);
  const [customCategories, setCustomCategories] = React.useState<CategoryOption[]>([]);
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [newCategoryColor, setNewCategoryColor] = React.useState('#22C55E');
  const [newCategoryIcon, setNewCategoryIcon] = React.useState<keyof typeof Ionicons.glyphMap>('pricetag-outline');
  const [monthlyBudgetInput, setMonthlyBudgetInput] = React.useState('');
  const newCategoryNameRef = React.useRef('');
  const monthlyBudgetInputRef = React.useRef('');
  const [showColorTray, setShowColorTray] = React.useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = React.useState(false);
  const [categoryManagerVisible, setCategoryManagerVisible] = React.useState(false);
  const [categoryManagerMode, setCategoryManagerMode] = React.useState<TransactionMode>(mode);
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [draftError, setDraftError] = React.useState('');
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);
  const [categoryOrder, setCategoryOrder] = React.useState<string[]>([]);
  const [builtinOverrides, setBuiltinOverrides] = React.useState<Record<string, BuiltinCategoryOverride>>({});
  const [hiddenBuiltinIds, setHiddenBuiltinIds] = React.useState<string[]>([]);
  const [undoCategory, setUndoCategory] = React.useState<{ item: CategoryOption; index: number } | null>(null);
  const undoTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeDrag, setActiveDrag] = React.useState<ActiveCategoryDrag | null>(null);
  const activeDragRef = React.useRef<ActiveCategoryDrag | null>(null);
  const categoriesRef = React.useRef<CategoryOption[]>([]);
  const categoriesLoadedRef = React.useRef(false);
  const settingsLoadedModeRef = React.useRef<TransactionMode | null>(null);
  const scrollGesture = React.useMemo(() => Gesture.Native(), []);

  const builtinCategories = React.useMemo(
    () => TRANSACTION_CATEGORIES[mode]
      .map((item) => {
        const id = `builtin-${mode}-${item.name}`;
        const override = builtinOverrides[id];
        const name = override?.name ?? item.name;
        return {
          id,
          name,
          label: labelForCategoryName(name),
          color: override?.color ?? categoryColorMap[item.name] ?? '#475569',
          icon: override?.icon ?? item.icon,
          type: 'builtin' as const,
          ...(typeof override?.monthlyBudget === 'number' && Number.isFinite(override.monthlyBudget)
            ? { monthlyBudget: override.monthlyBudget }
            : {}),
        };
      }),
    [builtinOverrides, mode],
  );

  const allCategories = React.useMemo(() => {
    const categories = [
      ...builtinCategories,
      ...customCategories.filter((item) => !item.mode || item.mode === mode),
    ];
    const orderIndex = new Map(categoryOrder.map((id, index) => [id, index]));
    return categories.sort((left, right) => {
      if (left.type !== right.type) return left.type === 'custom' ? -1 : 1;
      const leftIndex = orderIndex.get(left.id);
      const rightIndex = orderIndex.get(right.id);
      if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
      if (leftIndex !== undefined) return -1;
      if (rightIndex !== undefined) return 1;
      return sortLabel(left, right);
    });
  }, [builtinCategories, categoryOrder, customCategories, mode]);
  categoriesRef.current = allCategories;
  const pickerCategories = React.useMemo(
    () => allCategories.filter((item) => item.type !== 'builtin' || !hiddenBuiltinIds.includes(item.id)),
    [allCategories, hiddenBuiltinIds],
  );
  const managerBuiltinCategories = React.useMemo(
    () => TRANSACTION_CATEGORIES[categoryManagerMode].map((item) => {
      const id = `builtin-${categoryManagerMode}-${item.name}`;
      const override = builtinOverrides[id];
      const name = override?.name ?? item.name;
      return {
        id,
        name,
        label: labelForCategoryName(name),
        color: override?.color ?? categoryColorMap[item.name] ?? '#475569',
        icon: override?.icon ?? item.icon,
        type: 'builtin' as const,
        ...(typeof override?.monthlyBudget === 'number' && Number.isFinite(override.monthlyBudget)
          ? { monthlyBudget: override.monthlyBudget }
          : {}),
      };
    }).sort((left, right) => {
      const order = new Map(categoryOrder.map((id, index) => [id, index]));
      const leftIndex = order.get(left.id);
      const rightIndex = order.get(right.id);
      if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
      if (leftIndex !== undefined) return -1;
      if (rightIndex !== undefined) return 1;
      return sortLabel(left, right);
    }),
    [builtinOverrides, categoryManagerMode, categoryOrder],
  );
  const managerCustomCategories = React.useMemo(() => {
    const order = new Map(categoryOrder.map((id, index) => [id, index]));
    return customCategories
      .filter((item) => !item.mode || item.mode === categoryManagerMode)
      .sort((left, right) => {
      const leftIndex = order.get(left.id);
      const rightIndex = order.get(right.id);
      if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
      if (leftIndex !== undefined) return -1;
      if (rightIndex !== undefined) return 1;
      return sortLabel(left, right);
    });
  }, [categoryManagerMode, categoryOrder, customCategories]);
  const managerCategories = React.useMemo(
    () => [...managerCustomCategories, ...managerBuiltinCategories],
    [managerBuiltinCategories, managerCustomCategories],
  );
  const colorCategories = React.useMemo(
    () => [...new Map(
      [...customCategories, ...builtinCategories, ...managerBuiltinCategories]
        .map((item) => [item.id, item]),
    ).values()],
    [builtinCategories, customCategories, managerBuiltinCategories],
  );
  const categoryStats = React.useMemo(() => {
    if (!categoryManagerVisible) return EMPTY_CATEGORY_STATS;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const stats = new Map<string, { count: number; monthlyAmount: number }>();
    let monthlyTotal = 0;
    for (const transaction of transactions) {
      if (getTransactionMode(transaction) !== categoryManagerMode || !transaction.category) continue;
      const current = stats.get(transaction.category) ?? { count: 0, monthlyAmount: 0 };
      current.count += 1;
      const timestamp = transactionTimestamp(transaction);
      if (timestamp >= monthStart.getTime() && timestamp < monthEnd.getTime()) {
        current.monthlyAmount += Math.abs(transaction.amount);
        monthlyTotal += Math.abs(transaction.amount);
      }
      stats.set(transaction.category, current);
    }
    const result: Record<string, { count: number; monthlyAmount: number; formattedAmount: string; share: number }> = {};
    for (const category of [...managerCustomCategories, ...managerBuiltinCategories]) {
      const stat = stats.get(category.name) ?? { count: 0, monthlyAmount: 0 };
      result[category.id] = {
        ...stat,
        formattedAmount: formatWalletCurrency(stat.monthlyAmount, 'INR'),
        share: monthlyTotal > 0 ? stat.monthlyAmount / monthlyTotal : 0,
      };
    }
    return result;
  }, [categoryManagerMode, categoryManagerVisible, managerBuiltinCategories, managerCustomCategories, transactions]);

  const nextColor = React.useMemo(() => {
    const used = new Set(colorCategories.map((item) => item.color.toLowerCase()));
    for (const swatch of SWATCHES) {
      if (!used.has(swatch.toLowerCase())) return swatch;
    }
    return SWATCHES[0];
  }, [colorCategories]);

  const isColorUsedByAnotherCategory = React.useCallback((color: string) => (
    colorCategories.some((item) =>
      item.id !== editingCategoryId && item.color.toLowerCase() === color.toLowerCase(),
    )
  ), [colorCategories, editingCategoryId]);

  React.useEffect(() => {
    setNewCategoryColor(nextColor);
  }, [nextColor]);

  React.useEffect(() => {
    if (!visible) return;
    translateY.value = height;
    translateY.value = withSpring(0, { damping: 20, stiffness: 180 });
  }, [height, translateY, visible]);

  React.useEffect(() => {
    if (!visible) {
      setShowColorTray(false);
      setDraftError('');
      setNewCategoryName('');
      newCategoryNameRef.current = '';
      setMonthlyBudgetInput('');
      monthlyBudgetInputRef.current = '';
      setShowNewCategoryInput(false);
      setCategoryManagerVisible(false);
      setEditingCategoryId(null);
      return;
    }
    if (categoriesLoadedRef.current) return;
    const loadCategories = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Array<{ id: string; name: string; color: string; icon?: string; type: 'custom'; mode?: TransactionMode; monthlyBudget?: number }>;
          if (Array.isArray(parsed)) {
            const mapped: CategoryOption[] = parsed
              .filter((item) => item && item.id && item.name && item.color)
              .map((item) => ({
                id: item.id,
                name: item.name,
                label: item.name,
                color: item.color,
                icon: item.icon ?? 'pricetag-outline',
                type: 'custom',
                ...(item.mode === 'income' || item.mode === 'expense' ? { mode: item.mode } : {}),
                ...(typeof item.monthlyBudget === 'number' && Number.isFinite(item.monthlyBudget) && item.monthlyBudget >= 0
                  ? { monthlyBudget: item.monthlyBudget }
                  : {}),
              }));
            setCustomCategories(mapped.filter((item) => item.type === 'custom'));
          }
        }
        categoriesLoadedRef.current = true;
      } catch (error) {
        console.error('Could not load transaction categories.', error);
        Alert.alert('Could not load categories', 'Please reopen the transaction form and try again.');
      }
    };
    void loadCategories();
  }, [mode, visible]);

  const settingsMode = categoryManagerVisible ? categoryManagerMode : mode;
  React.useEffect(() => {
    if (!visible) return;
    if (settingsLoadedModeRef.current === settingsMode) return;
    let active = true;
    const loadModeSettings = async () => {
      try {
        const [rawOrder, rawOverrides, rawHidden] = await Promise.all([
          AsyncStorage.getItem(`${CATEGORY_ORDER_KEY}-${settingsMode}`),
          AsyncStorage.getItem(`${BUILTIN_OVERRIDES_KEY}-${settingsMode}`),
          AsyncStorage.getItem(`${HIDDEN_BUILTINS_KEY}-${settingsMode}`),
        ]);
        const parsedOrder: unknown = rawOrder ? JSON.parse(rawOrder) : [];
        const parsedOverrides: unknown = rawOverrides ? JSON.parse(rawOverrides) : {};
        const parsedHidden: unknown = rawHidden ? JSON.parse(rawHidden) : [];
        if (!active) return;
        settingsLoadedModeRef.current = settingsMode;
        setCategoryOrder(Array.isArray(parsedOrder) && parsedOrder.every((item) => typeof item === 'string') ? parsedOrder : []);
        setBuiltinOverrides(
          parsedOverrides && typeof parsedOverrides === 'object' && !Array.isArray(parsedOverrides)
            ? parsedOverrides as Record<string, BuiltinCategoryOverride>
            : {},
        );
        setHiddenBuiltinIds(Array.isArray(parsedHidden) && parsedHidden.every((item) => typeof item === 'string') ? parsedHidden : []);
      } catch (error) {
        console.error('Could not load category preferences.', error);
        Alert.alert('Could not load categories', 'Please reopen the transaction form and try again.');
      }
    };
    void loadModeSettings();
    return () => {
      active = false;
    };
  }, [settingsMode, visible]);

  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  React.useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

  const persistCustomCategories = React.useCallback(async (items: CategoryOption[]) => {
    const payload = items.filter((item) => item.type === 'custom').map((item) => ({
      id: item.id,
      name: item.name,
      color: item.color,
      icon: item.icon,
      type: item.type,
      ...(item.mode ? { mode: item.mode } : {}),
      ...(typeof item.monthlyBudget === 'number' && Number.isFinite(item.monthlyBudget)
        ? { monthlyBudget: item.monthlyBudget }
        : {}),
    }));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, []);

  const persistCategoryOrder = React.useCallback(async (nextOrder: string[]) => {
    const previousOrder = categoryOrder;
    setCategoryOrder(nextOrder);
    try {
      await AsyncStorage.setItem(`${CATEGORY_ORDER_KEY}-${categoryManagerMode}`, JSON.stringify(nextOrder));
      settingsLoadedModeRef.current = categoryManagerMode;
    } catch (error) {
      setCategoryOrder(previousOrder);
      console.error('Could not save category order.', error);
      Alert.alert('Could not reorder categories', 'Please try again.');
    }
  }, [categoryManagerMode, categoryOrder]);

  const startCategoryDrag = React.useCallback((categoryId: string, startIndex: number) => {
    const drag = { categoryId, startIndex, targetIndex: startIndex };
    activeDragRef.current = drag;
    setActiveDrag(drag);
  }, []);

  const moveCategoryDrag = React.useCallback((categoryId: string, startIndex: number, targetIndex: number) => {
    if (activeDragRef.current?.targetIndex === targetIndex) return;
    const drag = { categoryId, startIndex, targetIndex };
    activeDragRef.current = drag;
    setActiveDrag(drag);
  }, []);

  const endCategoryDrag = React.useCallback((categoryId: string, startIndex: number, targetIndex: number) => {
    if (targetIndex !== startIndex) {
      const nextOrder = categoriesRef.current.map((item) => item.id);
      const [movedId] = nextOrder.splice(startIndex, 1);
      nextOrder.splice(targetIndex, 0, movedId);
      void persistCategoryOrder(nextOrder);
    }
    activeDragRef.current = null;
    setActiveDrag(null);
  }, [persistCategoryOrder]);

  const cancelCategoryDrag = React.useCallback(() => {
    activeDragRef.current = null;
    setActiveDrag(null);
  }, []);

  const reorderManagerCategories = React.useCallback((
    type: CategoryOption['type'],
    startIndex: number,
    targetIndex: number,
  ) => {
    const source = type === 'custom' ? managerCustomCategories : managerBuiltinCategories;
    if (startIndex === targetIndex || !source[startIndex] || !source[targetIndex]) return;
    const reordered = [...source];
    const [moved] = reordered.splice(startIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const nextOrder = type === 'custom'
      ? [...reordered.map((item) => item.id), ...managerBuiltinCategories.map((item) => item.id)]
      : [...managerCustomCategories.map((item) => item.id), ...reordered.map((item) => item.id)];
    void persistCategoryOrder(nextOrder);
  }, [managerBuiltinCategories, managerCustomCategories, persistCategoryOrder]);

  const openCategoryManager = React.useCallback(() => {
    Keyboard.dismiss();
    setShowNewCategoryInput(false);
    setEditingCategoryId(null);
    setDraftError('');
    setCategoryManagerMode(mode);
    setCategoryManagerVisible(true);
  }, [mode]);

  const ensureCategoryName = (value: string) => value.trim().replace(/\s+/g, ' ');

  const startNewCategory = React.useCallback(() => {
    setEditingCategoryId(null);
    newCategoryNameRef.current = '';
    setNewCategoryName('');
    monthlyBudgetInputRef.current = '';
    setMonthlyBudgetInput('');
    setNewCategoryColor(nextColor);
    setNewCategoryIcon('pricetag-outline');
    setDraftError('');
    setShowNewCategoryInput(true);
  }, [nextColor]);

  const startEditingCategory = React.useCallback((category: CategoryOption) => {
    setEditingCategoryId(category.id);
    newCategoryNameRef.current = category.name;
    setNewCategoryName(category.name);
    monthlyBudgetInputRef.current =
      typeof category.monthlyBudget === 'number' ? String(category.monthlyBudget) : '';
    setMonthlyBudgetInput(
      typeof category.monthlyBudget === 'number' ? String(category.monthlyBudget) : '',
    );
    setNewCategoryColor(category.color);
    setNewCategoryIcon(
      CATEGORY_SYMBOLS.includes(category.icon as keyof typeof Ionicons.glyphMap)
        ? category.icon as keyof typeof Ionicons.glyphMap
        : 'pricetag-outline',
    );
    setDraftError('');
    setShowNewCategoryInput(true);
  }, []);

  const handleSelect = React.useCallback((category: CategoryOption) => {
    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const finalName = category.name;
    onSelect(finalName);
    setCategoryManagerVisible(false);
    if (!inline) onClose();
  }, [inline, onClose, onSelect]);

  const handleAddCustomCategory = React.useCallback(async (draft?: CategoryEditorDraft) => {
    const editingCategory = managerCategories.find((item) => item.id === editingCategoryId);
    const trimmed = editingCategory?.type === 'builtin'
      ? editingCategory.name
      : ensureCategoryName(draft?.name ?? newCategoryNameRef.current);
    const color = draft?.color ?? newCategoryColor;
    const icon = draft?.icon ?? newCategoryIcon;
    if (!trimmed) {
      setDraftError('Name is required.');
      return;
    }
    if (trimmed.length > 20) {
      setDraftError('Use 20 characters or fewer.');
      return;
    }
    if (!/^[A-Za-z0-9& ]+$/.test(trimmed)) {
      setDraftError('Use letters, numbers, spaces and & only.');
      return;
    }
    const duplicate = managerCategories.some(
      (item) => item.id !== editingCategoryId && (
        item.name.toLowerCase() === trimmed.toLowerCase() ||
        item.label.toLowerCase() === trimmed.toLowerCase()
      ),
    );
    if (duplicate) {
      setDraftError('Already exists');
      return;
    }
    if (isColorUsedByAnotherCategory(color)) {
      setDraftError('Choose a color that is not used by another category.');
      return;
    }
    const budgetDraft = draft?.monthlyBudget ?? monthlyBudgetInputRef.current;
    const hasMonthlyBudget = budgetDraft.trim().length > 0;
    const parsedMonthlyBudget = hasMonthlyBudget ? Number(budgetDraft) : undefined;
    if (
      hasMonthlyBudget &&
      (parsedMonthlyBudget === undefined ||
        !Number.isFinite(parsedMonthlyBudget) ||
        parsedMonthlyBudget < 0 ||
        parsedMonthlyBudget > 99999999999)
    ) {
      setDraftError('Enter a valid monthly budget.');
      return;
    }
    const monthlyBudget = categoryManagerMode === 'expense'
      ? parsedMonthlyBudget
      : editingCategory?.monthlyBudget;
    if (editingCategory?.type === 'builtin') {
      const nextOverrides = {
        ...builtinOverrides,
        [editingCategory.id]: {
          name: editingCategory.name,
          color,
          icon: editingCategory.icon,
          monthlyBudget,
        },
      };
      try {
        await AsyncStorage.setItem(`${BUILTIN_OVERRIDES_KEY}-${categoryManagerMode}`, JSON.stringify(nextOverrides));
        settingsLoadedModeRef.current = categoryManagerMode;
        setBuiltinOverrides(nextOverrides);
        newCategoryNameRef.current = '';
        setNewCategoryName('');
        monthlyBudgetInputRef.current = '';
        setMonthlyBudgetInput('');
        setEditingCategoryId(null);
        setShowNewCategoryInput(false);
        setDraftError('');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (error) {
        console.error('Could not update built-in transaction category.', error);
        setDraftError('Could not save changes. Please try again.');
      }
      return;
    }
    const item: CategoryOption = {
      id: editingCategory?.id ?? `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      label: trimmed,
      color,
      icon,
      type: 'custom',
      mode: editingCategory?.mode ?? categoryManagerMode,
      monthlyBudget,
    };
    const next = editingCategory
      ? customCategories.map((category) => category.id === editingCategory.id ? item : category)
      : [...customCategories, item];
    try {
      await persistCustomCategories(next);
      setCustomCategories(next);
      newCategoryNameRef.current = '';
      setNewCategoryName('');
      monthlyBudgetInputRef.current = '';
      setMonthlyBudgetInput('');
      setEditingCategoryId(null);
      setShowNewCategoryInput(false);
      setDraftError('');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (categoryManagerMode === mode && (
        !editingCategory || selectedCategoryName?.toLowerCase() === editingCategory.name.toLowerCase()
      )) {
        onSelect(item.name);
      }
    } catch (error) {
      console.error('Could not save transaction category.', error);
      setDraftError('Could not save category. Please try again.');
    }
    if (!inline) onClose();
  }, [categoryManagerMode, builtinOverrides, customCategories, editingCategoryId, inline, isColorUsedByAnotherCategory, managerCategories, mode, newCategoryColor, newCategoryIcon, onClose, onSelect, persistCustomCategories, selectedCategoryName]);

  const handleDeleteCustomCategory = React.useCallback((category: CategoryOption) => {
    if (category.type !== 'custom') return;
    Alert.alert(`Delete ${category.label}?`, 'Existing transactions keep this category name.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const index = managerCustomCategories.findIndex((item) => item.id === category.id);
            const next = customCategories.filter((item) => item.id !== category.id);
            await persistCustomCategories(next);
            setCustomCategories(next);
            setUndoCategory({ item: category, index: Math.max(0, index) });
            if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
            undoTimerRef.current = setTimeout(() => setUndoCategory(null), 5000);
            if (
              pickerCategories.some((item) => item.id === category.id) &&
              selectedCategoryName?.toLowerCase() === category.name.toLowerCase()
            ) {
              const fallback = pickerCategories.find((item) => item.id !== category.id);
              onSelect(fallback?.name ?? 'Other');
            }
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (error) {
            console.error('Could not delete transaction category.', error);
            Alert.alert('Could not delete category', 'Please try again.');
          }
        },
      },
    ]);
  }, [customCategories, managerCustomCategories, onSelect, persistCustomCategories, pickerCategories, selectedCategoryName]);

  const handleToggleBuiltinHidden = React.useCallback(async (category: CategoryOption) => {
    if (category.type !== 'builtin') return;
    try {
      const nextHidden = hiddenBuiltinIds.includes(category.id)
        ? hiddenBuiltinIds.filter((id) => id !== category.id)
        : [...hiddenBuiltinIds, category.id];
      await AsyncStorage.setItem(`${HIDDEN_BUILTINS_KEY}-${categoryManagerMode}`, JSON.stringify(nextHidden));
      settingsLoadedModeRef.current = categoryManagerMode;
      setHiddenBuiltinIds(nextHidden);
      if (
        nextHidden.includes(category.id) &&
        pickerCategories.some((item) => item.id === category.id) &&
        selectedCategoryName?.toLowerCase() === category.name.toLowerCase()
      ) {
        const fallback = pickerCategories.find((item) => item.id !== category.id);
        onSelect(fallback?.name ?? 'Other');
      }
    } catch (error) {
      console.error('Could not update hidden transaction categories.', error);
      Alert.alert('Could not update category visibility', 'Please try again.');
    }
  }, [categoryManagerMode, hiddenBuiltinIds, onSelect, pickerCategories, selectedCategoryName]);

  const restoreBuiltinCategories = React.useCallback(async () => {
    try {
      await AsyncStorage.setItem(`${HIDDEN_BUILTINS_KEY}-${categoryManagerMode}`, JSON.stringify([]));
      settingsLoadedModeRef.current = categoryManagerMode;
      setHiddenBuiltinIds([]);
    } catch (error) {
      console.error('Could not restore transaction categories.', error);
      Alert.alert('Could not restore categories', 'Please try again.');
    }
  }, [categoryManagerMode]);

  const undoDeleteCategory = React.useCallback(async () => {
    if (!undoCategory) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const next = [...customCategories];
    next.splice(Math.min(undoCategory.index, next.length), 0, undoCategory.item);
    try {
      await persistCustomCategories(next);
      setCustomCategories(next);
      setUndoCategory(null);
    } catch (error) {
      console.error('Could not restore deleted category.', error);
      Alert.alert('Could not restore category', 'Please try again.');
    }
  }, [customCategories, persistCustomCategories, undoCategory]);

  const editingCategoryForForm = managerCategories.find((item) => item.id === editingCategoryId);
  const editingBuiltinCategory = editingCategoryForForm?.type === 'builtin';
  const normalizedDraftName = ensureCategoryName(newCategoryName);
  const draftAlreadyExists = normalizedDraftName.length > 0 && managerCategories.some((item) => (
    item.id !== editingCategoryId && (
      item.name.toLowerCase() === normalizedDraftName.toLowerCase() ||
      item.label.toLowerCase() === normalizedDraftName.toLowerCase()
    )
  ));
  const parsedDraftBudget = monthlyBudgetInput.trim() ? Number(monthlyBudgetInput) : undefined;
  const monthlyBudgetIsValid = parsedDraftBudget === undefined ||
    (Number.isFinite(parsedDraftBudget) && parsedDraftBudget >= 0 && parsedDraftBudget <= 99999999999);
  const draftIsValid = editingBuiltinCategory
    ? !isColorUsedByAnotherCategory(newCategoryColor) && monthlyBudgetIsValid
    : normalizedDraftName.length > 0 && normalizedDraftName.length <= 20 && !draftAlreadyExists &&
      /^[A-Za-z0-9& ]+$/.test(normalizedDraftName) &&
      !isColorUsedByAnotherCategory(newCategoryColor) &&
      (categoryManagerMode !== 'expense' || monthlyBudgetIsValid);
  const availableSwatches = SWATCHES.filter((swatch) => !isColorUsedByAnotherCategory(swatch));
  const colorSwatches = [
    ...availableSwatches,
    ...SWATCHES.filter((swatch) => isColorUsedByAnotherCategory(swatch)),
  ].slice(0, 12);
  if (SWATCHES.includes(newCategoryColor) && !colorSwatches.includes(newCategoryColor)) {
    colorSwatches[colorSwatches.length - 1] = newCategoryColor;
  }
  const managerAccent = categoryManagerMode === 'income' ? theme.colors.incomeAccent : theme.colors.categoryAccent;
  const iconOptionSize = Math.min(52, Math.max(32, Math.floor((width - 84) / 6)));

  const managerEditor = React.useMemo(() => {
    if (!showNewCategoryInput) return null;
    const usedColors = colorCategories
      .filter((item) => item.id !== editingCategoryId)
      .map((item) => item.color);
    return (
      <CategoryManagerEditor
        key={editingCategoryId ?? 'new'}
        bottomInset={insets.bottom}
        categoryId={editingCategoryId}
        isBuiltin={editingBuiltinCategory}
        mode={categoryManagerMode}
        initialName={newCategoryName}
        initialColor={newCategoryColor}
        initialIcon={newCategoryIcon}
        initialBudget={monthlyBudgetInput}
        accent={managerAccent}
        swatches={colorSwatches}
        usedColors={usedColors}
        iconSize={iconOptionSize}
        error={draftError || (draftAlreadyExists ? 'Already exists' : '')}
        onClose={() => {
          setEditingCategoryId(null);
          setShowNewCategoryInput(false);
          setDraftError('');
        }}
        onSave={(draft) => { void handleAddCustomCategory(draft); }}
      />
    );
  }, [
    categoryManagerMode,
    colorCategories,
    colorSwatches,
    draftAlreadyExists,
    draftError,
    editingBuiltinCategory,
    editingCategoryId,
    handleAddCustomCategory,
    iconOptionSize,
    insets.bottom,
    managerAccent,
    monthlyBudgetInput,
    newCategoryColor,
    newCategoryIcon,
    newCategoryName,
    showNewCategoryInput,
  ]);
  const managerOverlay = React.useMemo(() => {
    if (!categoryManagerVisible) return null;
    return (
      <View pointerEvents="box-none" style={styles.managerPortalLayer}>
        <CategoryManagerScreen
          mode={categoryManagerMode}
          customCategories={managerCustomCategories}
          builtinCategories={managerBuiltinCategories}
          hiddenBuiltinIds={hiddenBuiltinIds}
          stats={categoryStats}
          categoryCount={managerCategories.length}
          form={managerEditor}
          snackbar={undoCategory ? 'Category deleted' : undefined}
          onUndo={() => { void undoDeleteCategory(); }}
          onClose={() => {
            setCategoryManagerVisible(false);
            setShowNewCategoryInput(false);
            setEditingCategoryId(null);
          }}
          onModeChange={setCategoryManagerMode}
          onAdd={startNewCategory}
          onEdit={startEditingCategory}
          onDelete={handleDeleteCustomCategory}
          onToggleHidden={(item) => { void handleToggleBuiltinHidden(item); }}
          onReorder={reorderManagerCategories}
        />
      </View>
    );
  }, [
    categoryManagerMode,
    categoryManagerVisible,
    categoryStats,
    handleDeleteCustomCategory,
    handleToggleBuiltinHidden,
    hiddenBuiltinIds,
    managerBuiltinCategories,
    managerCategories.length,
    managerCustomCategories,
    managerEditor,
    reorderManagerCategories,
    startEditingCategory,
    startNewCategory,
    undoCategory,
    undoDeleteCategory,
  ]);
  const managerOverlayRevision = categoryManagerVisible
    ? JSON.stringify([
      categoryManagerMode,
      managerCustomCategories,
      managerBuiltinCategories,
      hiddenBuiltinIds,
      categoryStats,
      undoCategory,
      showNewCategoryInput,
      editingCategoryId,
      newCategoryColor,
      newCategoryIcon,
      draftError,
      selectedCategoryName,
    ])
    : 'closed';
  React.useEffect(() => {
    if (!inline || !onManagerOverlayChange) return undefined;
    onManagerOverlayChange(managerOverlay, managerOverlayRevision);
  }, [inline, managerOverlay, managerOverlayRevision, onManagerOverlayChange]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const renderItem = ({ item }: { item: CategoryOption }) => {
    const selected =
      item.name.toLowerCase() === (selectedCategoryName ?? '').toLowerCase() ||
      item.label.toLowerCase() === (selectedCategoryName ?? '').toLowerCase();

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected }}
        onPress={() => {
          Keyboard.dismiss();
          handleSelect(item);
        }}
        onLongPress={() => item.type === 'custom' && handleDeleteCustomCategory(item)}
        style={({ pressed }) => [
          styles.cell,
          isCompactPicker && styles.expenseCell,
          selected && [
            styles.selectedCell,
            {
              borderColor: `${accent}55`,
              backgroundColor: isExpensePicker ? '#FFF1E8' : `${accent}0D`,
            },
          ],
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        <View style={[styles.badgeWrap, isCompactPicker && styles.expenseBadgeWrap]}>
          <View
            style={[
              styles.badge,
              isCompactPicker && styles.expenseBadge,
              { backgroundColor: `${item.color}16` },
              selected && { backgroundColor: `${accent}20` },
            ]}
          >
            <Ionicons
              name={item.icon as keyof typeof Ionicons.glyphMap}
              size={isCompactPicker ? 18 : 17}
              color={item.color}
            />
          </View>
          {selected ? <View style={[styles.checkChip, { backgroundColor: accent }]}><Feather name="check" size={9} color="#FFF" /></View> : null}
        </View>
        <Text
          numberOfLines={2}
          style={[
            styles.cellLabel,
            isCompactPicker && styles.expenseCellLabel,
            selected && styles.cellLabelSelected,
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  const pickerHeight = Math.max(320, height * 0.76);

  if (inline) {
    return (
      <>
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.inlineExpenseList}
        >
          {pickerCategories.map((item) => (
            <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Manage categories"
            onPress={openCategoryManager}
            style={({ pressed }) => [
              styles.cell,
              styles.expenseCell,
              styles.inlineAddCategory,
              { borderColor: `${accent}45` },
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <View style={[styles.badgeWrap, styles.expenseBadgeWrap]}>
              <View style={[styles.badge, styles.expenseBadge, { backgroundColor: `${accent}16` }]}>
                <Ionicons name="settings-outline" size={18} color={accent} />
              </View>
            </View>
            <Text numberOfLines={2} style={[styles.cellLabel, styles.expenseCellLabel]}>Manage</Text>
          </Pressable>
        </ScrollView>

        {!inline ? (
        <Modal
          visible={categoryManagerVisible && !inline}
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => {
            setCategoryManagerVisible(false);
            setShowNewCategoryInput(false);
            setEditingCategoryId(null);
          }}
        >
          <CategoryManagerScreen
            mode={categoryManagerMode}
            customCategories={managerCustomCategories}
            builtinCategories={managerBuiltinCategories}
            hiddenBuiltinIds={hiddenBuiltinIds}
            stats={categoryStats}
            categoryCount={managerCategories.length}
            form={null}
            snackbar={undoCategory ? 'Category deleted' : undefined}
            onUndo={() => { void undoDeleteCategory(); }}
            onClose={() => {
              setCategoryManagerVisible(false);
              setShowNewCategoryInput(false);
              setEditingCategoryId(null);
            }}
            onModeChange={setCategoryManagerMode}
            onAdd={startNewCategory}
            onEdit={startEditingCategory}
            onDelete={handleDeleteCustomCategory}
            onToggleHidden={(item) => { void handleToggleBuiltinHidden(item); }}
            onReorder={reorderManagerCategories}
          />
          <GestureHandlerRootView pointerEvents="box-none" style={styles.managerScreen}>
            <View style={[styles.managerContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.managerHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close category manager"
                onPress={() => {
                  setCategoryManagerVisible(false);
                  setShowNewCategoryInput(false);
                  setEditingCategoryId(null);
                }}
                style={styles.managerBackButton}
              >
                <Feather name="arrow-left" size={20} color="#252B36" />
              </Pressable>
              <View style={styles.managerTitleWrap}>
                <Text style={styles.managerTitle}>Manage categories</Text>
                <Text style={styles.managerSubtitle}>Tap to select · Hold a card to reorder · Edit or delete</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={startNewCategory}
              style={[styles.managerAddButton, { backgroundColor: `${accent}0E`, borderColor: `${accent}35` }]}
            >
              <Feather name="plus-circle" size={18} color={accent} />
              <Text style={[styles.managerAddText, { color: accent }]}>Add category</Text>
            </Pressable>
            {hiddenBuiltinIds.some((id) => id.startsWith(`builtin-${mode}-`)) ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => { void restoreBuiltinCategories(); }}
                style={styles.restoreCategoriesButton}
              >
                <Feather name="rotate-ccw" size={15} color="#626B7A" />
                <Text style={styles.restoreCategoriesText}>Restore deleted built-in categories</Text>
              </Pressable>
            ) : null}

              <GestureDetector gesture={scrollGesture}>
                <ScrollView
                  style={styles.managerList}
                  contentContainerStyle={styles.managerListContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {allCategories.map((item, index) => (
                    <CategoryManagerRow
                      key={item.id}
                      item={item}
                      index={index}
                      itemCount={allCategories.length}
                      isSelected={item.name.toLowerCase() === (selectedCategoryName ?? '').toLowerCase()}
                      accent={accent}
                      activeDrag={activeDrag}
                      scrollGesture={scrollGesture}
                      onSelect={handleSelect}
                      onEdit={startEditingCategory}
                      onDelete={handleDeleteCustomCategory}
                      onDragStart={startCategoryDrag}
                      onDragMove={moveCategoryDrag}
                      onDragEnd={endCategoryDrag}
                      onDragCancel={cancelCategoryDrag}
                    />
                  ))}
                </ScrollView>
              </GestureDetector>
            </View>
            {showNewCategoryInput ? (
              <View style={styles.editOverlay}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel category changes"
                  onPress={() => {
                    setEditingCategoryId(null);
                    setShowNewCategoryInput(false);
                    setDraftError('');
                  }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={[styles.editCard, { paddingBottom: insets.bottom + 24 }]}>
                  <View style={styles.editCardHeader}>
                    <View style={styles.managerPreview}>
                      <LinearGradient
                        colors={[`${newCategoryColor}CC`, newCategoryColor]}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <Ionicons name={newCategoryIcon} size={38} color="#FFFFFF" />
                    </View>
                    <View style={styles.managerTitleWrap}>
                      <Text style={styles.managerFormTitle}>
                        {editingCategoryId ? 'Edit category' : 'New category'}
                      </Text>
                      <Text style={styles.managerSubtitle}>
                        {editingBuiltinCategory ? 'Built-in names and icons stay locked.' : 'Choose a name, icon, and color.'}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close category form"
                      onPress={() => {
                        setEditingCategoryId(null);
                        setShowNewCategoryInput(false);
                        setDraftError('');
                      }}
                      style={styles.managerActionButton}
                    >
                      <Feather name="x" size={18} color="#586071" />
                    </Pressable>
                  </View>
                  <TextInput
                    accessibilityLabel="Category name"
                    value={newCategoryName}
                    editable={!editingBuiltinCategory}
                    onChangeText={(value) => {
                      setNewCategoryName(value.slice(0, 20));
                      setDraftError('');
                    }}
                    placeholder="Category name"
                    placeholderTextColor="#8A8D96"
                    style={[styles.editNameInput, editingBuiltinCategory && styles.lockedNameInput]}
                    maxLength={20}
                    returnKeyType="done"
                  />
                  {!editingBuiltinCategory ? (
                    <>
                      <Text style={styles.managerFieldLabel}>ICON</Text>
                      <View style={styles.iconGrid}>
                        {CATEGORY_SYMBOLS.slice(0, 24).map((symbol) => {
                          const selected = newCategoryIcon === symbol;
                          return (
                            <Pressable
                              key={symbol}
                              accessibilityRole="button"
                              accessibilityLabel={`Select ${symbol.replace('-outline', '').replace(/-/g, ' ')} icon`}
                              accessibilityState={{ selected }}
                              onPress={() => setNewCategoryIcon(symbol)}
                              style={[
                                styles.iconGridOption,
                                selected && { borderColor: managerAccent, backgroundColor: `${managerAccent}14` },
                              ]}
                            >
                              <Ionicons name={symbol} size={21} color={selected ? managerAccent : '#555D6B'} />
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  ) : null}
                  <Text style={styles.managerFieldLabel}>COLOR</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.managerSwatches}>
                    {colorSwatches.map((swatch) => {
                      const used = isColorUsedByAnotherCategory(swatch);
                      return (
                        <Pressable
                          key={swatch}
                          accessibilityRole="button"
                          accessibilityLabel={used ? `${swatch}, already used` : `Choose color ${swatch}`}
                          accessibilityState={{ selected: newCategoryColor === swatch, disabled: used }}
                          disabled={used}
                          onPress={() => setNewCategoryColor(swatch)}
                          style={[
                            styles.swatch,
                            styles.formSwatch,
                            { backgroundColor: swatch },
                            used && styles.swatchUnavailable,
                            newCategoryColor === swatch && [styles.formSwatchSelected, { borderColor: managerAccent }],
                          ]}
                        />
                      );
                    })}
                  </ScrollView>
                  {draftError || draftAlreadyExists || availableSwatches.length === 0 ? (
                    <Text style={styles.managerError}>
                      {draftError || (draftAlreadyExists ? 'Already exists' : 'No colors available.')}
                    </Text>
                  ) : null}
                  <View style={styles.managerFormActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => { void handleAddCustomCategory(); }}
                      disabled={!draftIsValid}
                      style={[
                        styles.managerSaveButton,
                        { backgroundColor: draftIsValid ? managerAccent : '#B8B8BE' },
                      ]}
                    >
                      <Text style={styles.managerSaveText}>{draftIsValid
                        ? editingCategoryId ? 'Save changes' : 'Create category'
                        : 'Complete all fields'}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}
          </GestureHandlerRootView>
        </Modal>
        ) : null}
      </>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View style={[styles.sheet, { height: pickerHeight, maxHeight: height - 48 }, sheetStyle]}>
          <LinearGradient colors={heroColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.dragHandleWrap}>
              <View style={styles.dragHandle} />
            </View>
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <View style={styles.headerEyebrowRow}>
                  <View style={styles.headerIcon}>
                    <Feather name={mode === 'income' ? 'arrow-down-left' : 'arrow-up-right'} size={13} color="#FFFFFF" />
                  </View>
                  <Text style={styles.headerEyebrow}>{mode === 'income' ? 'MONEY IN' : 'MONEY OUT'}</Text>
                </View>
                <Text style={styles.title}>Choose category</Text>
                <Text style={styles.subtitle}>Pick the best fit for this transaction.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close categories" onPress={onClose} style={styles.closeButton}>
                <Feather name="x" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
          </LinearGradient>

          <View style={styles.categorySectionHeader}>
            <Text style={styles.sectionTitle}>CATEGORIES</Text>
            {isExpensePicker ? <Text style={styles.scrollHint}>Swipe to explore</Text> : null}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowNewCategoryInput((value) => !value)}
            style={[styles.addCategoryButton, { borderColor: `${accent}45`, backgroundColor: `${accent}0B` }]}
          >
            <View style={[styles.addCategoryIcon, { backgroundColor: accent }]}>
              <Feather name="plus" size={13} color="#FFFFFF" />
            </View>
            <Text style={styles.addCategoryText}>New category</Text>
            <Feather name="chevron-right" size={15} color={accent} />
          </Pressable>

          {showNewCategoryInput ? (
            <View style={[styles.newCategoryBar, { marginBottom: insets.bottom + 8 }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowColorTray((value) => !value)}
                style={[styles.colorDot, { backgroundColor: newCategoryColor }]}
              >
                <Text style={styles.colorDotText}>{newCategoryName.trim().charAt(0)?.toUpperCase() || 'N'}</Text>
              </Pressable>
              <TextInput
                value={newCategoryName}
                onChangeText={(value) => {
                  setNewCategoryName(value.slice(0, 20));
                  setDraftError('');
                }}
                placeholder="New category"
                placeholderTextColor="#666"
                style={styles.newCategoryInput}
                returnKeyType="done"
                onSubmitEditing={() => { void handleAddCustomCategory(); }}
                onFocus={() => setShowColorTray(false)}
              />
              {newCategoryName.trim() ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { void handleAddCustomCategory(); }}
                  style={[styles.checkButton, { backgroundColor: accent }]}
                >
                  <Feather name="check" size={18} color="#FFF" />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <FlatList
            key={mode}
            data={pickerCategories}
            keyExtractor={(item) => item.id}
            horizontal={isExpensePicker}
            numColumns={isExpensePicker ? 1 : 4}
            columnWrapperStyle={isExpensePicker ? undefined : styles.columnWrap}
            contentContainerStyle={[
              styles.listContent,
              isExpensePicker && styles.expenseListContent,
              { paddingBottom: keyboardOpen ? 28 : 12 },
            ]}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            renderItem={renderItem}
          />

          {showColorTray ? (
            <View style={styles.swatchPanel}>
              {SWATCHES.map((swatch) => (
                <Pressable
                  key={swatch}
                  onPress={() => {
                    setNewCategoryColor(swatch);
                    setShowColorTray(false);
                  }}
                  style={[styles.swatch, { backgroundColor: swatch }, newCategoryColor === swatch && styles.swatchSelected]}
                />
              ))}
            </View>
          ) : null}
          {draftError ? <Text style={styles.inlineError}>{draftError}</Text> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9,17,30,0.22)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(9,17,30,0.38)',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#F7F7F8',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 0,
    overflow: 'hidden',
  },
  hero: {
    paddingBottom: 15,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 9,
    paddingBottom: 11,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  headerEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerIcon: {
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.17)',
  },
  headerEyebrow: {
    color: 'rgba(255,255,255,0.77)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.6,
    marginTop: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.73)',
    fontSize: 11,
    marginTop: 2,
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 2,
    color: '#737985',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginHorizontal: 18,
  },
  scrollHint: {
    color: '#9096A0',
    fontSize: 10,
    fontWeight: '500',
  },
  addCategoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 42,
    marginHorizontal: 18,
    marginTop: 7,
    marginBottom: 4,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  addCategoryIcon: {
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCategoryText: {
    flex: 1,
    color: '#303642',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 7,
    paddingBottom: 10,
  },
  expenseListContent: {
    alignItems: 'flex-start',
    paddingRight: 18,
  },
  inlineExpenseList: {
    alignItems: 'flex-start',
    paddingTop: 2,
    paddingBottom: 0,
    paddingRight: 18,
  },
  managerScreen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
  },
  managerPortalLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    elevation: 50,
  },
  managerContent: {
    display: 'none',
  },
  editOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
    elevation: 5,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.38)',
  },
  editCard: {
    width: '100%',
    maxHeight: '92%',
    padding: 22,
    paddingTop: 24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: '#FFFFFF',
    shadowColor: '#101828',
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  editNameInput: {
    height: 50,
    paddingHorizontal: 15,
    borderRadius: 15,
    backgroundColor: '#F7F5F4',
    borderWidth: 1,
    borderColor: '#E9E4E1',
    color: '#171311',
    fontSize: 16,
  },
  budgetInputWrap: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9E4E1',
    backgroundColor: '#F7F5F4',
  },
  budgetCurrency: {
    marginRight: 8,
    color: '#514943',
    fontSize: 17,
    fontWeight: '600',
  },
  budgetInput: {
    flex: 1,
    height: '100%',
    padding: 0,
    color: '#171311',
    fontSize: 16,
  },
  budgetHint: {
    marginTop: 5,
    color: '#85818A',
    fontSize: 11,
  },
  lockedNameInput: {
    color: '#77716E',
    backgroundColor: '#F0EEED',
  },
  editCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  managerPreview: {
    width: 88,
    height: 88,
    overflow: 'hidden',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    shadowColor: '#171311',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  managerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 18,
  },
  managerBackButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F2F4',
    marginRight: 12,
  },
  managerTitleWrap: {
    flex: 1,
  },
  managerTitle: {
    color: '#202632',
    fontSize: 20,
    fontWeight: '700',
  },
  managerSubtitle: {
    color: '#737985',
    fontSize: 12,
    marginTop: 3,
  },
  managerAddButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 2,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  managerAddText: {
    fontSize: 14,
    fontWeight: '600',
  },
  restoreCategoriesButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 7,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  restoreCategoriesText: {
    color: '#626B7A',
    fontSize: 12,
    fontWeight: '600',
  },
  managerForm: {
    marginHorizontal: 18,
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E7EB',
  },
  managerFormTitle: {
    color: '#171311',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  managerFieldLabel: {
    color: '#777D88',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 7,
  },
  managerSwatches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 2,
  },
  formSwatch: {
    width: 27,
    height: 27,
    borderRadius: 14,
  },
  formSwatchSelected: {
    borderWidth: 3,
    borderColor: '#24201E',
    shadowColor: '#171311',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  iconGridOption: {
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9E4E1',
    backgroundColor: '#FFFFFF',
  },
  managerError: {
    color: '#B42318',
    fontSize: 12,
    marginTop: 8,
  },
  managerFormActions: {
    marginTop: 18,
  },
  managerCancelButton: {
    height: 42,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F1F2F4',
  },
  managerCancelText: {
    color: '#4B5360',
    fontSize: 13,
    fontWeight: '600',
  },
  managerSaveButton: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 27,
  },
  managerSaveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  managerList: {
    flex: 1,
  },
  managerListContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 8,
  },
  managerCategoryRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E7E8EC',
    backgroundColor: '#FFFFFF',
  },
  managerDraggingRow: {
    zIndex: 2,
    elevation: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.36,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  managerFadedRow: {
    opacity: 0.45,
  },
  managerCategorySelect: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  managerCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  managerCategoryInfo: {
    flex: 1,
    minWidth: 0,
  },
  managerCategoryName: {
    color: '#252B36',
    fontSize: 14,
    fontWeight: '600',
  },
  managerCategoryType: {
    color: '#858A95',
    fontSize: 11,
    marginTop: 3,
  },
  managerActions: {
    flexDirection: 'row',
    gap: 5,
    marginLeft: 8,
  },
  managerActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  managerDragHandle: {
    width: 30,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },
  inlineAddCategory: {
    borderStyle: 'dashed',
    backgroundColor: '#FFF8F5',
  },
  inlineNewCategoryWrap: {
    marginTop: 8,
    gap: 7,
  },
  inlineCreateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 6,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E4E6EA',
    backgroundColor: '#FFFFFF',
  },
  inlineColorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  inlineNameInput: {
    flex: 1,
    minWidth: 0,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: '#F7F7F8',
    color: '#252B36',
    fontSize: 13,
  },
  inlineSymbolList: {
    gap: 6,
    paddingRight: 18,
  },
  inlineSymbolOption: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6E7EB',
    backgroundColor: '#FFFFFF',
  },
  inlineSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  inlineSwatchPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  columnWrap: {
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  cell: {
    width: '25%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 75,
    paddingVertical: 5,
    paddingHorizontal: 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: '#FFFFFF',
  },
  expenseCell: {
    width: 82,
    height: 76,
    minHeight: 76,
    marginLeft: 1,
    marginRight: 7,
    paddingVertical: 4,
    borderRadius: 13,
    borderColor: '#E8E9ED',
    backgroundColor: '#FFF8F5',
  },
  selectedCell: {
    backgroundColor: '#FFFFFF',
  },
  badgeWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  expenseBadgeWrap: {
    width: 30,
    height: 30,
  },
  expenseBadge: {
    width: 29,
    height: 29,
    borderRadius: 10,
  },
  badge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLetter: {
    fontWeight: '700',
    fontSize: 15,
  },
  checkChip: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cellLabel: {
    marginTop: 3,
    textAlign: 'center',
    fontSize: 10,
    color: '#525A67',
    lineHeight: 13,
  },
  expenseCellLabel: {
    width: '100%',
    flexShrink: 1,
    minHeight: 22,
    marginTop: 5,
    paddingHorizontal: 2,
    fontSize: 9,
    lineHeight: 11,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  cellLabelSelected: {
    color: '#252B36',
    fontWeight: '700',
  },
  newCategoryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E6EA',
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  newCategoryInput: {
    flex: 1,
    fontSize: 14,
    color: '#252B36',
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E3E8',
    lineHeight: 18,
  },
  checkButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,17,17,0.1)',
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: '#111',
  },
  swatchUnavailable: {
    opacity: 0.28,
  },
  inlineError: {
    marginHorizontal: 18,
    marginTop: 8,
    color: '#B42318',
    fontSize: 12,
    lineHeight: 16,
  },
  inputPlaceholder: {
    color: '#67676A',
  },
});
