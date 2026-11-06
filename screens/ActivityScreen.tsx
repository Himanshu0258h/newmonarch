import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather, Ionicons } from '@expo/vector-icons';
import { NavigationBar } from 'expo-navigation-bar';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatWalletCurrency, useWalletCards } from '../context/WalletCardsContext';
import { getWalletCardDisplayName } from '../data/walletCards';
import { transactionTimestamp, type Transaction } from '../data/transactions';
import theme from '../theme';
import WalletBackground from '../components/wallet/WalletBackground';
import {
  filterActivityTransactions,
  groupActivityByLocalDay,
  inferRecurringTransactionIds,
  type ActivityDateRange,
  type ActivityAccount,
  type ActivityFilter,
  type ActivitySection,
} from '../utils/activity';
import {
  getTransactionMode,
  TRANSACTION_CATEGORIES,
  TRANSACTION_CATEGORIES_STORAGE_KEY,
  transactionCategoryOverridesStorageKey,
  TRANSACTION_CATEGORY_COLORS,
} from '../utils/transactionCategories';

type Props = {
  cardId?: string;
  initialFilter?: ActivityFilter;
  onBack: () => void;
  onAddExpense: () => void;
  onOpenTransaction?: (transactionId: string) => void;
};

type CategoryPresentation = {
  name: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type ActivityRowProps = {
  transaction: Transaction;
  category: CategoryPresentation;
  isRecurring: boolean;
  animateIndex: number;
  reducedMotion: boolean;
  onPress: () => void;
};

const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList<Transaction, ActivitySection<Transaction>>,
);
const FILTERS: ReadonlyArray<{ value: ActivityFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateLabel(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function dateRangeLabel(range: ActivityDateRange) {
  if (range.start.getTime() === range.end.getTime()) return dateLabel(range.start);
  return `${dateLabel(range.start)} – ${dateLabel(range.end)}`;
}

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

function CategoryBadge({ category }: { category: CategoryPresentation }) {
  return (
    <View style={styles.categoryBadge}>
      <LinearGradient
        colors={[lightenColor(category.color), category.color]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Ionicons name={category.icon} size={23} color={theme.colors.white} />
    </View>
  );
}

const ActivityRow = React.memo(function ActivityRow({
  transaction,
  category,
  isRecurring,
  animateIndex,
  reducedMotion,
  onPress,
}: ActivityRowProps) {
  const mode = getTransactionMode(transaction);
  const positive = mode === 'income';
  const amount = `${positive ? '+' : '−'}${formatWalletCurrency(transaction.amount, 'INR')}`;
  const timestamp = transactionTimestamp(transaction);
  const timeLabel = timestamp > 0
    ? new Date(timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : '';
  const accessibilityLabel = [
    positive ? 'Income' : 'Expense',
    transaction.title,
    `${transaction.amount.toFixed(2)} rupees`,
    transaction.category ?? 'Other',
    transaction.subtitle,
  ].join(', ');
  const entering = reducedMotion
    ? FadeIn.duration(120)
    : animateIndex >= 0
      ? FadeInUp.delay(animateIndex * 30).duration(220)
      : undefined;

  return (
    <Animated.View entering={entering}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        style={({ pressed }) => [styles.transactionCard, pressed && styles.transactionCardPressed]}
      >
        <CategoryBadge category={category} />
        <View style={styles.transactionDetails}>
          <View style={styles.titleLine}>
            <Text numberOfLines={1} style={styles.transactionTitle}>{transaction.title}</Text>
            {isRecurring ? (
              <View style={styles.repeatTag}>
                <Text style={styles.repeatText}>REPEATS</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaLine}>
            <Text numberOfLines={1} style={styles.transactionMeta}>
              {transaction.category ?? 'Other'}{timeLabel ? ` · ${timeLabel}` : ''}
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.transactionAmount,
            {
              color: positive ? theme.colors.activityIncome : theme.colors.deleteAccent,
            },
          ]}
          numberOfLines={1}
        >
          {amount}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

function ActivitySkeleton({ reducedMotion }: { reducedMotion: boolean }) {
  const shimmer = useSharedValue(0.55);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  React.useEffect(() => {
    if (reducedMotion) return;
    shimmer.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(shimmer);
  }, [reducedMotion, shimmer]);
  return (
    <View style={styles.skeletonList}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Animated.View key={index} style={[styles.skeletonCard, shimmerStyle]}>
          <View style={styles.skeletonBadge} />
          <View style={styles.skeletonText}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonSubtitle} />
          </View>
          <View style={styles.skeletonAmount} />
        </Animated.View>
      ))}
    </View>
  );
}

function ActivityScreen({
  cardId,
  initialFilter = 'all',
  onBack,
  onAddExpense,
  onOpenTransaction,
}: Props) {
  const insets = useSafeAreaInsets();
  const { cards, transactions, isLoading } = useWalletCards();
  const reducedMotion = useReducedMotion();
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });
  const [filter, setFilter] = React.useState<ActivityFilter>(initialFilter);
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [cardFilter, setCardFilter] = React.useState(cardId);
  const [dateRange, setDateRange] = React.useState<ActivityDateRange | undefined>();
  const [calendarVisible, setCalendarVisible] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState(() => new Date());
  const [draftDateRange, setDraftDateRange] = React.useState<{
    start: Date;
    end?: Date;
  }>();
  const [customCategories, setCustomCategories] = React.useState<CategoryPresentation[]>([]);
  const animatedIds = React.useRef(new Set<string>());

  React.useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  React.useEffect(() => {
    setCardFilter(cardId);
  }, [cardId]);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem(TRANSACTION_CATEGORIES_STORAGE_KEY),
      AsyncStorage.getItem(transactionCategoryOverridesStorageKey('expense')),
      AsyncStorage.getItem(transactionCategoryOverridesStorageKey('income')),
    ])
      .then(([storedCustom, storedExpenseOverrides, storedIncomeOverrides]) => {
        if (!active) return;
        const parseRecord = (value: string | null): Record<string, unknown> => {
          if (!value) return {};
          const parsed: unknown = JSON.parse(value);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Stored category data has an invalid format.');
          }
          return parsed as Record<string, unknown>;
        };
        let custom: unknown[] = [];
        if (storedCustom) {
          const parsed: unknown = JSON.parse(storedCustom);
          if (!Array.isArray(parsed)) {
            throw new Error('Stored transaction categories have an invalid format.');
          }
          custom = parsed;
        }
        const result: CategoryPresentation[] = custom.flatMap((item): CategoryPresentation[] => {
          if (!item || typeof item !== 'object') return [];
          const record = item as Record<string, unknown>;
          if (typeof record.name !== 'string' || typeof record.color !== 'string') return [];
          const icon = typeof record.icon === 'string' && record.icon in Ionicons.glyphMap
            ? record.icon as keyof typeof Ionicons.glyphMap
            : 'pricetag-outline';
          return [{ name: record.name, color: record.color, icon }];
        });
        const overrides = {
          ...parseRecord(storedExpenseOverrides),
          ...parseRecord(storedIncomeOverrides),
        };
        for (const mode of ['expense', 'income'] as const) {
          for (const item of TRANSACTION_CATEGORIES[mode]) {
            const id = `builtin-${mode}-${item.name}`;
            const override = overrides[id];
            const overrideRecord = override && typeof override === 'object'
              ? override as Record<string, unknown>
              : {};
            result.push({
              name: item.name,
              color: typeof overrideRecord.color === 'string'
                ? overrideRecord.color
                : TRANSACTION_CATEGORY_COLORS[item.name] ?? theme.colors.categoryAccent,
              icon: typeof overrideRecord.icon === 'string' && overrideRecord.icon in Ionicons.glyphMap
                ? overrideRecord.icon as keyof typeof Ionicons.glyphMap
                : item.icon,
            });
          }
        }
        setCustomCategories(result);
      })
      .catch((error: unknown) => {
        console.error('Could not load categories for Activity.', error);
      });
    return () => { active = false; };
  }, []);

  const accounts = React.useMemo(() => new Map<string, ActivityAccount>(
    cards.map((card) => [card.id, {
      id: card.id,
      name: getWalletCardDisplayName(card),
      number: card.number,
      network: card.network,
    }]),
  ), [cards]);
  const recurringIds = React.useMemo(
    () => inferRecurringTransactionIds(transactions),
    [transactions],
  );
  const visibleTransactions = React.useMemo(
    () => filterActivityTransactions(transactions, accounts, {
      filter,
      query: debouncedQuery,
      cardId: cardFilter,
      dateRange,
    }),
    [accounts, cardFilter, dateRange, debouncedQuery, filter, transactions],
  );
  const sections = React.useMemo(
    () => groupActivityByLocalDay(visibleTransactions),
    [visibleTransactions],
  );
  const sectionListData = React.useMemo(
    () => sections.map((section) => ({ ...section, data: section.data })),
    [sections],
  );
  const categoryLookup = React.useMemo(() => {
    const result = new Map<string, CategoryPresentation>();
    for (const mode of ['expense', 'income'] as const) {
      for (const category of TRANSACTION_CATEGORIES[mode]) {
        result.set(category.name.toLocaleLowerCase(), {
          name: category.name,
          color: TRANSACTION_CATEGORY_COLORS[category.name] ?? theme.colors.categoryAccent,
          icon: category.icon,
        });
      }
    }
    customCategories.forEach((category) => result.set(category.name.toLocaleLowerCase(), category));
    return result;
  }, [customCategories]);
  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scrollY.value, [0, 70], [1, 0.8], 'clamp') }],
  }));
  const counterStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 70], [1, 0], 'clamp'),
  }));

  const selectedCard = cardFilter ? cards.find((card) => card.id === cardFilter) : undefined;
  const totalCount = React.useMemo(
    () => cardFilter
      ? transactions.filter((transaction) => transaction.accountId === cardFilter).length
      : transactions.length,
    [cardFilter, transactions],
  );
  const sheetTop = insets.top + 126;
  const calendarDays = React.useMemo(() => {
    const firstWeekday = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1,
    ).getDay();
    const daysInMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [calendarMonth]);
  const openCalendar = React.useCallback(() => {
    setDraftDateRange(dateRange);
    setCalendarMonth(dateRange?.start ?? new Date());
    setCalendarVisible(true);
  }, [dateRange]);
  const selectCalendarDay = React.useCallback((date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    setDraftDateRange((current) => {
      if (!current || current.end) return { start: day };
      if (day.getTime() < current.start.getTime()) {
        return { start: day, end: current.start };
      }
      return { start: current.start, end: day };
    });
  }, []);
  const accountChipLabel = selectedCard
    ? `${getWalletCardDisplayName(selectedCard)}${selectedCard.number
      ? ` •••• ${selectedCard.number.replace(/\D/g, '').slice(-4)}`
      : ''}`
    : '';
  const renderItem = React.useCallback(({ item }: { item: Transaction }) => {
    const category = categoryLookup.get((item.category ?? '').toLocaleLowerCase()) ?? {
      name: item.category ?? 'Other',
      color: theme.colors.categoryAccent,
      icon: 'pricetag-outline' as const,
    };
    const isNew = !animatedIds.current.has(item.id);
    const animateIndex = isNew && animatedIds.current.size < 10
      ? animatedIds.current.size
      : -1;
    animatedIds.current.add(item.id);
    return (
      <ActivityRow
        transaction={item}
        category={category}
        isRecurring={recurringIds.has(item.id)}
        animateIndex={animateIndex}
        reducedMotion={reducedMotion}
        onPress={() => onOpenTransaction?.(item.id)}
      />
    );
  }, [categoryLookup, onOpenTransaction, reducedMotion, recurringIds]);
  const renderSectionHeader = React.useCallback((
    { section }: { section: ActivitySection },
  ) => (
    <View accessibilityRole="header" style={styles.dayHeader}>
      <Text style={styles.dayLabel}>{section.title}</Text>
      <Text style={[
        styles.dayTotal,
        section.total > 0 && styles.positiveAmount,
      ]}>
        {`${section.total > 0 ? '+' : section.total < 0 ? '−' : ''}${formatWalletCurrency(Math.abs(section.total), 'INR')}`}
      </Text>
    </View>
  ), []);
  const emptyComponent = React.useMemo(() => {
    if (isLoading) {
      return (
        <ActivitySkeleton reducedMotion={reducedMotion} />
      );
    }
    if (transactions.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="receipt-outline" size={28} color={theme.colors.categoryAccent} />
          </View>
          <Text style={styles.emptyTitle}>No transactions yet</Text>
          <Pressable accessibilityRole="button" onPress={onAddExpense} style={styles.emptyAction}>
            <Text style={styles.emptyActionText}>Add expense</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No results{debouncedQuery ? ` for “${debouncedQuery}”` : ''}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setQuery('');
            setFilter('all');
            setCardFilter(undefined);
            setDateRange(undefined);
          }}
          style={styles.emptyAction}
        >
          <Text style={styles.emptyActionText}>Clear filters</Text>
        </Pressable>
      </View>
    );
  }, [debouncedQuery, isLoading, onAddExpense, reducedMotion, transactions.length]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <NavigationBar style="light" />
      <WalletBackground variant="activity" scrollY={scrollY} />

      <View style={[styles.header, { height: sheetTop + 24, paddingTop: insets.top + theme.spacing.xs }]}>
        <View style={styles.headerTop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={19} color={theme.colors.white} />
          </Pressable>
          <Animated.View style={[styles.titleWrap, titleStyle]}>
            <Text style={styles.title}>Activity</Text>
          </Animated.View>
          <Animated.Text style={[styles.counter, counterStyle]}>
            {`${visibleTransactions.length} of ${totalCount}`}
          </Animated.Text>
        </View>
        <View style={styles.searchBar}>
          <Feather name="search" size={17} color={theme.colors.activityMuted} />
          <TextInput
            accessibilityLabel="Search transactions"
            value={query}
            onChangeText={setQuery}
            placeholder="Search merchants, notes, amounts"
            placeholderTextColor={theme.colors.activityMuted}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery('')}
              style={styles.clearSearch}
            >
              <Feather name="x" size={16} color={theme.colors.activityMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.sheet, { top: sheetTop, paddingBottom: insets.bottom }]}>
        <View style={styles.filters}>
          {FILTERS.map((item) => {
            const selected = filter === item.value;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  if (selected) return;
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFilter(item.value);
                }}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dateRange
              ? `Choose transaction date, ${dateRangeLabel(dateRange)} selected`
              : 'Choose transaction date'}
            accessibilityState={{ selected: Boolean(dateRange) }}
            onPress={openCalendar}
            style={[styles.calendarButton, dateRange && styles.filterChipSelected]}
          >
            <Feather
              name="calendar"
              size={17}
              color={dateRange ? theme.colors.white : theme.colors.text}
            />
          </Pressable>
        </View>
        {dateRange ? (
          <View style={styles.accountChipRow}>
            <View style={styles.accountChip}>
              <Feather name="calendar" size={14} color={theme.colors.categoryAccent} />
              <Text style={styles.accountChipText}>{dateRangeLabel(dateRange)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear date filter"
                onPress={() => setDateRange(undefined)}
                hitSlop={8}
              >
                <Feather name="x" size={14} color={theme.colors.text} />
              </Pressable>
            </View>
          </View>
        ) : null}
        {selectedCard ? (
          <View style={styles.accountChipRow}>
            <View style={styles.accountChip}>
              <View style={[styles.brandDot, { backgroundColor: selectedCard.colors[0] }]} />
              <Text numberOfLines={1} style={styles.accountChipText}>{accountChipLabel}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove account filter"
                onPress={() => setCardFilter(undefined)}
                hitSlop={8}
              >
                <Feather name="x" size={14} color={theme.colors.text} />
              </Pressable>
            </View>
          </View>
        ) : null}
        <AnimatedSectionList
          sections={sectionListData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          initialNumToRender={20}
          windowSize={7}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={emptyComponent}
        />
      </View>
      {calendarVisible ? (
        <View style={styles.calendarOverlay}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close calendar"
            onPress={() => setCalendarVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.calendarCard}>
            <View style={styles.calendarTitleRow}>
              <Text style={styles.calendarTitle}>Choose date</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close calendar"
                onPress={() => setCalendarVisible(false)}
                hitSlop={8}
              >
                <Feather name="x" size={20} color={theme.colors.activityMuted} />
              </Pressable>
            </View>
            <View style={styles.calendarMonthRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                onPress={() => setCalendarMonth((month) => new Date(
                  month.getFullYear(),
                  month.getMonth() - 1,
                  1,
                ))}
                style={styles.calendarMonthButton}
              >
                <Feather name="chevron-left" size={20} color={theme.colors.text} />
              </Pressable>
              <Text style={styles.calendarMonth}>
                {calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next month"
                onPress={() => setCalendarMonth((month) => new Date(
                  month.getFullYear(),
                  month.getMonth() + 1,
                  1,
                ))}
                style={styles.calendarMonthButton}
              >
                <Feather name="chevron-right" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
            <View style={styles.calendarGrid}>
              {WEEKDAYS.map((day, index) => (
                <Text key={`${day}-${index}`} style={styles.calendarWeekday}>{day}</Text>
              ))}
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.calendarDayCell} />;
                }
                const date = new Date(
                  calendarMonth.getFullYear(),
                  calendarMonth.getMonth(),
                  day,
                );
                const dayTime = date.getTime();
                const rangeStart = draftDateRange?.start.getTime();
                const rangeEnd = draftDateRange?.end?.getTime() ?? rangeStart;
                const isRangeEndpoint = dayTime === rangeStart || dayTime === rangeEnd;
                const isInRange = rangeStart !== undefined
                  && rangeEnd !== undefined
                  && dayTime >= rangeStart
                  && dayTime <= rangeEnd;
                const isRangeStart = isInRange && dayTime === rangeStart;
                const isRangeEnd = isInRange && dayTime === rangeEnd;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={dateLabel(date)}
                    accessibilityState={{ selected: isRangeEndpoint }}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      selectCalendarDay(date);
                    }}
                    style={styles.calendarDayCell}
                  >
                    <View style={[
                      styles.calendarDayCircle,
                      isInRange && styles.calendarDayInRange,
                      isRangeEndpoint && styles.calendarDaySelected,
                    ]}>
                      <Text style={[
                        styles.calendarDayText,
                        isRangeEndpoint && styles.calendarDayTextSelected,
                      ]}>
                        {day}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.calendarActions}>
              <View style={styles.calendarQuickActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear selected date range"
                  disabled={!draftDateRange && !dateRange}
                  onPress={() => setDraftDateRange(undefined)}
                  style={[
                    styles.calendarClearButton,
                    !draftDateRange && !dateRange && styles.calendarActionDisabled,
                  ]}
                >
                  <Text style={styles.calendarClearText}>Clear</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const today = new Date();
                    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    setDraftDateRange({ start: todayStart, end: todayStart });
                    setCalendarMonth(todayStart);
                  }}
                  style={styles.calendarClearButton}
                >
                  <Text style={styles.calendarClearText}>Today</Text>
                </Pressable>
              </View>
              <View style={styles.calendarActionButtons}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setDraftDateRange(dateRange);
                    setCalendarVisible(false);
                  }}
                  style={styles.calendarCancelButton}
                >
                  <Text style={styles.calendarCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setDateRange(draftDateRange
                      ? { start: draftDateRange.start, end: draftDateRange.end ?? draftDateRange.start }
                      : undefined);
                    setCalendarVisible(false);
                  }}
                  style={styles.calendarTodayButton}
                >
                  <Text style={styles.calendarTodayText}>Apply</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.warmSheet,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: theme.spacing.lg,
  },
  headerTop: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.glassButton,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.activityGlass,
    borderWidth: 1,
    borderColor: theme.colors.activityGlassBorder,
  },
  titleWrap: {
    flex: 1,
    transformOrigin: 'left center',
  },
  title: {
    ...theme.typography.activityTitle,
    color: theme.colors.white,
  },
  counter: {
    ...theme.typography.activityCounter,
    color: theme.colors.activityCounter,
    fontVariant: ['tabular-nums'],
  },
  searchBar: {
    height: 48,
    marginTop: theme.spacing.md,
    marginHorizontal: -4,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.activitySearch,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    color: theme.colors.text,
    ...theme.typography.activitySearch,
    paddingVertical: 0,
  },
  clearSearch: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.warmSheet,
    borderTopLeftRadius: theme.radii.sheetTop,
    borderTopRightRadius: theme.radii.sheetTop,
    paddingTop: theme.spacing.md,
    ...theme.shadows.sheet,
  },
  filters: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  filterChip: {
    minHeight: 36,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.activityBorder,
  },
  filterChipSelected: {
    backgroundColor: theme.colors.text,
    borderColor: theme.colors.text,
  },
  filterText: {
    color: theme.colors.text,
    ...theme.typography.activityFilter,
    fontSize: 13,
  },
  filterTextSelected: {
    color: theme.colors.white,
  },
  calendarButton: {
    width: 40,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.activityBorder,
  },
  calendarOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 30,
    elevation: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  calendarCard: {
    width: '100%',
    maxWidth: 360,
    padding: theme.spacing.lg,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.warmSheet,
    ...theme.shadows.activityCard,
  },
  calendarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  calendarTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  calendarMonthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  calendarMonthButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
  },
  calendarDayInRange: {
    backgroundColor: theme.colors.activityDateRange,
    borderRadius: 16,
  },
  calendarMonth: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarWeekday: {
    width: '14.2857%',
    height: 36,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: theme.colors.activityMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  calendarDayCell: {
    width: '14.2857%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCircle: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  calendarDaySelected: {
    backgroundColor: theme.colors.text,
  },
  calendarDayText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  calendarDayTextSelected: {
    color: theme.colors.white,
  },
  calendarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  calendarQuickActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  calendarClearButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  calendarActionDisabled: {
    opacity: 0.45,
  },
  calendarClearText: {
    color: theme.colors.activityMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  calendarTodayButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.text,
  },
  calendarCancelButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  calendarCancelText: {
    color: theme.colors.activityMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  calendarTodayText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  accountChipRow: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  },
  accountChip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.activityBorder,
  },
  accountChipText: {
    maxWidth: 260,
    color: theme.colors.text,
    ...theme.typography.activityMeta,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.pill,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    flexGrow: 1,
  },
  dayHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.warmSheet,
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.sm,
    marginBottom: theme.spacing.xs - 1,
  },
  dayLabel: {
    ...theme.typography.activityLabel,
    color: theme.colors.activityMuted,
  },
  dayTotal: {
    color: theme.colors.activityMuted,
    ...theme.typography.activityDayTotal,
    fontVariant: ['tabular-nums'],
  },
  positiveAmount: {
    color: theme.colors.activityIncome,
  },
  transactionCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.row,
    borderRadius: theme.radii.activityRow,
    backgroundColor: theme.colors.white,
    ...theme.shadows.activityCard,
  },
  transactionCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  categoryBadge: {
    width: 40,
    height: 40,
    overflow: 'hidden',
    borderRadius: theme.radii.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDetails: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    gap: theme.spacing.xs,
  },
  transactionTitle: {
    flexShrink: 1,
    color: theme.colors.text,
    ...theme.typography.activityRowTitle,
  },
  repeatTag: {
    flexShrink: 0,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.activityRepeat,
  },
  repeatText: {
    color: theme.colors.activityMuted,
    ...theme.typography.activityRepeat,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    marginTop: theme.spacing.xxs - 1,
  },
  transactionMeta: {
    flexShrink: 1,
    color: theme.colors.activityMuted,
    ...theme.typography.activityMeta,
  },
  networkMark: {
    flexShrink: 0,
    color: theme.colors.activityMuted,
    fontSize: 9,
    fontWeight: '700',
    marginLeft: theme.spacing.xxs,
  },
  transactionAmount: {
    flexShrink: 0,
    minWidth: 86,
    textAlign: 'right',
    color: theme.colors.text,
    fontSize: theme.typography.activityAmount.fontSize - 2,
    lineHeight: 19,
    fontWeight: theme.typography.activityAmount.fontWeight,
    letterSpacing: theme.typography.activityAmount.letterSpacing,
    fontVariant: ['tabular-nums'],
  },
  emptyState: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.categoryAccentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: theme.colors.text,
    ...theme.typography.activityEmpty,
    textAlign: 'center',
  },
  emptyAction: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.action,
    backgroundColor: theme.colors.categoryAccent,
  },
  emptyActionText: {
    color: theme.colors.white,
    ...theme.typography.activityButton,
  },
  skeletonList: {
    paddingTop: theme.spacing.sm,
  },
  skeletonCard: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.row,
    borderRadius: theme.radii.activityRow,
    backgroundColor: theme.colors.white,
  },
  skeletonBadge: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.badge,
    backgroundColor: theme.colors.background,
  },
  skeletonText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  skeletonTitle: {
    width: '70%',
    height: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.background,
  },
  skeletonSubtitle: {
    width: '90%',
    height: 11,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.background,
  },
  skeletonAmount: {
    width: 64,
    height: 14,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.background,
  },
});

export default React.memo(ActivityScreen);
