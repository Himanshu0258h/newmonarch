import React from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import AnimatedReanimated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CategoryPickerSheet from './CategoryPickerSheet';
import { formatWalletCurrency } from '../context/WalletCardsContext';
import {
  getWalletCardDisplayName,
  getWalletCardTypeLabel,
  type WalletCard,
  type WalletTransaction,
} from '../data/walletCards';
import { transactionTimestamp, type Transaction } from '../data/transactions';
import { getTransactionMode, TRANSACTION_CATEGORIES, type TransactionMode } from '../utils/transactionCategories';

type SaveReceipt = {
  transaction: Transaction;
  accountId: string;
  walletTransactionId: string;
  balanceDelta: number;
  monthlySpendDelta: number;
};

type Props = {
  mode: TransactionMode;
  visible: boolean;
  initialTransaction?: Transaction | null;
  cards: readonly WalletCard[];
  transactions: readonly Transaction[];
  onClose: () => void;
  onAddCard: () => void;
  onSave: (
    transaction: Transaction,
    walletTransaction: WalletTransaction,
    balanceDelta: number,
    monthlySpendDelta: number,
  ) => Promise<void>;
  onSaved: (receipt: SaveReceipt) => void;
};

function TransactionSheetHost({
  children,
  onLayout,
}: {
  children: React.ReactNode;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const content = <View style={styles.hostContent} onLayout={onLayout}>{children}</View>;
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView behavior="padding" style={styles.hostContent}>
        {content}
      </KeyboardAvoidingView>
    );
  }
  return content;
}

const MAX_AMOUNT = 999999999.99;
const REQUIRE_NOTE = true;

function getDefaultAccount(cards: readonly WalletCard[]) {
  return [...cards].sort((left, right) => {
    if (left.isDefault) return -1;
    if (right.isDefault) return 1;
    const time = (value: WalletCard['lastUsedAt']) =>
      typeof value === 'number' ? value : Date.parse(value ?? '') || 0;
    return time(right.lastUsedAt) - time(left.lastUsedAt);
  })[0]?.id ?? '';
}

function groupedAmountInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, '');
  const decimalIndex = cleaned.indexOf('.');
  let integer = decimalIndex === -1 ? cleaned : cleaned.slice(0, decimalIndex);
  const fraction = decimalIndex === -1 ? '' : cleaned.slice(decimalIndex + 1).replace(/\./g, '').slice(0, 2);
  integer = integer.replace(/^0+(?=\d)/, '');
  const grouped = integer
    ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(integer))
    : '';
  return `${grouped}${decimalIndex >= 0 ? `.${fraction}` : ''}`;
}

function amountValue(value: string) {
  return Number(value.replace(/,/g, ''));
}

function localDateTime(date: Date) {
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isSameDay = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
  return `${isSameDay(date, today) ? 'Today' : isSameDay(date, yesterday) ? 'Yesterday' : day}, ${time}`;
}

function transactionMode(transaction: Transaction) {
  return getTransactionMode(transaction);
}

function TransactionSheet({
  mode,
  visible,
  initialTransaction,
  cards,
  transactions,
  onClose,
  onAddCard,
  onSave,
  onSaved,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const scaleFactor = Math.min(1.12, Math.max(0.82, width / 390));
  const accent = mode === 'income' ? '#17A978' : '#F05A3A';
  const heroColors = mode === 'income'
    ? ['#073B32', '#087B5A', '#16A878'] as const
    : ['#662118', '#B83C25', '#F05A3A'] as const;
  const categories = TRANSACTION_CATEGORIES[mode];
  const [amount, setAmount] = React.useState('');
  const [merchant, setMerchant] = React.useState('');
  const [category, setCategory] = React.useState<string | null>(null);
  const [accountId, setAccountId] = React.useState(() => getDefaultAccount(cards));
  const [date, setDate] = React.useState(() => new Date());
  const [note, setNote] = React.useState('');
  const [attachment, setAttachment] = React.useState<Transaction['attachment']>();
  const [touched, setTouched] = React.useState<{ amount?: boolean; merchant?: boolean; date?: boolean; account?: boolean; category?: boolean; note?: boolean }>({});
  const [attempted, setAttempted] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [picker, setPicker] = React.useState<'date' | 'time' | null>(null);
  const [iosPickerVisible, setIosPickerVisible] = React.useState(false);
  const [keyboardOpen, setKeyboardOpen] = React.useState(false);
  const [discardConfirmationVisible, setDiscardConfirmationVisible] = React.useState(false);
  const [categoryManagerOverlay, setCategoryManagerOverlay] = React.useState<{
    revision: string;
    node: React.ReactNode;
  } | null>(null);
  const [availableHeight, setAvailableHeight] = React.useState(height);
  const backdropProgress = useSharedValue(0);
  const sheetTranslateY = useSharedValue(height);
  const categoryPulse = useSharedValue(1);
  const sheetHeightRef = React.useRef(height);
  const scrollRef = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const scrollOffset = React.useRef(0);
  const keyboardFocusTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyboardHeightRef = React.useRef(0);
  const keyboardTopRef = React.useRef<number | null>(null);
  const amountRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const merchantRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const noteRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focusedField, setFocusedField] = React.useState<string | null>(null);
  const focusedFieldRef = React.useRef<string | null>(null);
  const closing = React.useRef(false);
  const closeNotified = React.useRef(false);
  const onCloseRef = React.useRef(onClose);
  const sheetAnimatedForOpen = React.useRef(false);
  const openedAt = React.useRef(new Date());
  const wasVisible = React.useRef(false);
  const minSheetHeight = availableHeight * 0.55;
  const maxSheetHeight = Math.max(availableHeight - insets.top - 8, minSheetHeight);
  const sheetHeight = Math.max(minSheetHeight, Math.min(availableHeight * 0.94, maxSheetHeight));
  const footerBottomPadding = keyboardOpen ? 12 : insets.bottom + 12;
  sheetHeightRef.current = sheetHeight;
  onCloseRef.current = onClose;

  const selectedCard = cards.find((card) => card.id === accountId);
  const parsedAmount = amountValue(amount);
  const trimmedMerchant = merchant.trim();
  const trimmedNote = note.trim();
  const amountError =
    !amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0
      ? 'Enter an amount greater than zero.'
      : parsedAmount > MAX_AMOUNT
        ? 'Amount must be 99,99,99,999.99 or less.'
        : undefined;
  const merchantError = !trimmedMerchant
    ? 'Enter who this transaction is from.'
    : trimmedMerchant.length > 40
      ? 'Use 40 characters or fewer.'
      : !/[\p{L}\p{N}]/u.test(trimmedMerchant)
        ? 'Enter a name with letters or numbers.'
        : undefined;
  const dateIsFuture = date.getTime() > Date.now();
  const dateError = mode === 'expense' && dateIsFuture
    ? 'Expenses cannot be dated in the future.'
    : undefined;
  const accountError = !selectedCard ? 'Select an account' : undefined;
  const categoryError = !category ? 'Select a category' : undefined;
  const noteError = REQUIRE_NOTE && trimmedNote.length < 3 ? 'Add a short note' : undefined;
  const valid = !amountError && !merchantError && !dateError && !accountError && !categoryError && !noteError;
  const activeError = <T extends string | undefined>(message: T, field: 'amount' | 'merchant' | 'date' | 'account' | 'category' | 'note') =>
    (attempted || touched[field]) && message
      ? <Text accessibilityLiveRegion="polite" style={styles.error}>{message}</Text>
      : null;

  const merchantUsage = React.useMemo(() => {
    const counts = new Map<string, { count: number; lastTime: number; category?: string }>();
    transactions.forEach((transaction) => {
      if (transactionMode(transaction) !== mode) return;
      const label = transaction.title.trim();
      if (!label) return;
      const key = label.toLocaleLowerCase();
      const current = counts.get(key) ?? { count: 0, lastTime: 0 };
      const timestamp = transactionTimestamp(transaction);
      counts.set(key, {
        count: current.count + 1,
        lastTime: Math.max(current.lastTime, timestamp),
        category: timestamp >= current.lastTime ? transaction.category ?? current.category : current.category,
      });
    });
    return [...counts.entries()]
      .sort((left, right) => right[1].count - left[1].count || right[1].lastTime - left[1].lastTime)
      .slice(0, 6)
      .map(([key, info]) => ({ name: key, ...info }));
  }, [mode, transactions]);

  const merchantSuggestions = React.useMemo(() => {
    const query = merchant.trim().toLocaleLowerCase();
    return merchantUsage.filter((item) => !query || item.name.includes(query)).slice(0, 6);
  }, [merchant, merchantUsage]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropProgress.value * 0.45 }));

  React.useEffect(() => {
    if (!visible) {
      wasVisible.current = false;
      sheetAnimatedForOpen.current = false;
      return;
    }
    if (wasVisible.current) return;
    wasVisible.current = true;
    setAmount(initialTransaction ? String(initialTransaction.amount) : '');
    setMerchant(initialTransaction?.title ?? '');
    setCategory(
      initialTransaction?.category &&
        categories.some((item) => item.name === initialTransaction.category)
        ? initialTransaction.category
        : null,
    );
    setAccountId(
      initialTransaction?.accountId && cards.some((card) => card.id === initialTransaction.accountId)
        ? initialTransaction.accountId
        : getDefaultAccount(cards),
    );
    openedAt.current = new Date();
    const initialTimestamp = initialTransaction ? transactionTimestamp(initialTransaction) : 0;
    setDate(initialTimestamp > 0 ? new Date(initialTimestamp) : openedAt.current);
    setNote(initialTransaction?.note ?? '');
    setAttachment(initialTransaction?.attachment);
    setTouched({});
    setAttempted(false);
    setSaveError('');
    setSaving(false);
    setDiscardConfirmationVisible(false);
    closing.current = false;
    closeNotified.current = false;
    sheetAnimatedForOpen.current = false;
    sheetTranslateY.value = sheetHeightRef.current;
    backdropProgress.value = withTiming(1, { duration: reducedMotion ? 120 : 180 });
  }, [backdropProgress, cards, categories, initialTransaction, reducedMotion, sheetTranslateY, visible]);

  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardOpen(true);
      keyboardTopRef.current = event.endCoordinates.screenY;
      keyboardHeightRef.current = event.endCoordinates.height;
      if (keyboardFocusTimeout.current) clearTimeout(keyboardFocusTimeout.current);
      keyboardFocusTimeout.current = setTimeout(() => {
        const focusedInput = focusedFieldRef.current === 'note'
          ? noteRef
          : focusedFieldRef.current === 'merchant'
            ? merchantRef
            : focusedFieldRef.current === 'amount'
              ? amountRef
              : null;
        if (focusedInput?.current?.isFocused()) focusScroll(focusedInput);
      }, 180);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardOpen(false);
      keyboardTopRef.current = null;
      keyboardHeightRef.current = 0;
      if (keyboardFocusTimeout.current) {
        clearTimeout(keyboardFocusTimeout.current);
        keyboardFocusTimeout.current = null;
      }
    });
    return () => {
      show.remove();
      hide.remove();
      if (keyboardFocusTimeout.current) clearTimeout(keyboardFocusTimeout.current);
    };
  }, []);

  const notifyClosed = React.useCallback(() => {
    if (closeNotified.current) return;
    closeNotified.current = true;
    onCloseRef.current();
  }, []);

  const close = React.useCallback(() => {
    if (closing.current || saving) return;
    closing.current = true;
    Keyboard.dismiss();
    backdropProgress.value = withTiming(0, { duration: reducedMotion ? 120 : 180 });
    sheetTranslateY.value = withTiming(sheetHeight, { duration: 240 }, (finished) => {
      if (finished) runOnJS(notifyClosed)();
    });
  }, [backdropProgress, notifyClosed, reducedMotion, saving, sheetHeight, sheetTranslateY]);

  const requiredCompleted = React.useMemo(() => {
    return [
      Boolean(amount.trim()) && Number.isFinite(parsedAmount) && parsedAmount > 0,
      trimmedMerchant.length >= 2,
      Boolean(date),
      Boolean(selectedCard),
      Boolean(category),
      REQUIRE_NOTE ? trimmedNote.length >= 3 : true,
    ].filter(Boolean).length;
  }, [amount, category, date, parsedAmount, selectedCard, trimmedMerchant, trimmedNote]);

  const requiredTotal = 6;
  const requiredProgress = (requiredCompleted / requiredTotal) * 100;

  const hasInput = Boolean(
    amount ||
    merchant.trim() ||
    note.trim() ||
    attachment ||
    Boolean(category) ||
    accountId !== getDefaultAccount(cards) ||
    Math.abs(date.getTime() - openedAt.current.getTime()) > 60_000,
  );
  const requestClose = React.useCallback(() => {
    if (hasInput) {
      setDiscardConfirmationVisible(true);
      return;
    }
    close();
  }, [close, hasInput]);

  const panResponder = React.useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 8,
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > 80) requestClose();
      },
    }),
    [requestClose],
  );

  const focusScroll = (input: React.RefObject<React.ComponentRef<typeof TextInput> | null>) => {
    const field = input.current;
    const scroll = scrollRef.current;
    if (!field || !scroll) return;
    field.measureInWindow((_fieldX, fieldY, _fieldWidth, fieldHeight) => {
      scroll.measureInWindow((_scrollX, scrollY, _scrollWidth, scrollHeight) => {
        const viewportBottom = scrollY + scrollHeight;
        const keyboardBoundary = keyboardTopRef.current ?? viewportBottom;
        const visibleBottom = Math.min(viewportBottom, keyboardBoundary) - 16;
        const overlap = fieldY + fieldHeight - visibleBottom;
        if (overlap > 0) {
          scroll.scrollTo({
            y: Math.max(0, scrollOffset.current + overlap),
            animated: true,
          });
        }
      });
    });
  };

  const addAttachment = async () => {
    Keyboard.dismiss();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setAttachment({
        name: file.name,
        uri: file.uri,
        ...(file.mimeType ? { mimeType: file.mimeType } : {}),
        ...(file.size !== undefined ? { size: file.size } : {}),
      });
      setSaveError('');
    } catch (error) {
      console.error('Could not select transaction attachment.', error);
      setSaveError("Couldn't add attachment. Try again.");
    }
  };

  const chooseMerchant = (suggestion: (typeof merchantUsage)[number]) => {
    const original = transactions.find(
      (transaction) => transaction.title.trim().toLocaleLowerCase() === suggestion.name,
    );
    setMerchant(original?.title ?? suggestion.name.replace(/\b\w/g, (letter) => letter.toUpperCase()));
    if (suggestion.category && categories.some((item) => item.name === suggestion.category)) {
      setCategory(suggestion.category);
    }
  };

  const handlePickerChange = (event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android') setPicker(null);
    if (event.type === 'dismissed' || !value) {
      setIosPickerVisible(false);
      setPicker(null);
      return;
    }
    if (picker === 'date') {
      const next = new Date(date);
      next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
      setDate(next);
    } else {
      const next = new Date(date);
      next.setHours(value.getHours(), value.getMinutes(), 0, 0);
      setDate(next);
    }
    setTouched((current) => ({ ...current, date: true }));
  };

  const focusMissingField = React.useCallback((field: 'amount' | 'merchant' | 'date' | 'account' | 'category' | 'note') => {
    if (field === 'amount') {
      amountRef.current?.focus();
      focusScroll(amountRef);
      return;
    }
    if (field === 'merchant') {
      merchantRef.current?.focus();
      focusScroll(merchantRef);
      return;
    }
    if (field === 'note') {
      noteRef.current?.focus();
      focusScroll(noteRef);
      return;
    }
    if (field === 'date') {
      setPicker('date');
      if (Platform.OS === 'ios') setIosPickerVisible(true);
      return;
    }
    if (field === 'category') {
      categoryPulse.value = withSequence(
        withTiming(1.04, { duration: 90 }),
        withTiming(1, { duration: 90 }),
      );
      return;
    }
    if (field === 'account') {
      setFocusedField('account');
      focusedFieldRef.current = 'account';
      Keyboard.dismiss();
    }
  }, [categoryPulse]);

  const executeSave = async () => {
    setAttempted(true);
    setSaveError('');
    const missingField =
      amountError ??
      merchantError ??
      dateError ??
      accountError ??
      categoryError ??
      noteError;
    if (missingField) {
      if (amountError) {
        setTouched((current) => ({ ...current, amount: true }));
        focusMissingField('amount');
      } else if (merchantError) {
        setTouched((current) => ({ ...current, merchant: true }));
        focusMissingField('merchant');
      } else if (dateError) {
        setTouched((current) => ({ ...current, date: true }));
        focusMissingField('date');
      } else if (accountError) {
        setTouched((current) => ({ ...current, account: true }));
        focusMissingField('account');
      } else if (categoryError) {
        setTouched((current) => ({ ...current, category: true }));
        focusMissingField('category');
      } else if (noteError) {
        setTouched((current) => ({ ...current, note: true }));
        focusMissingField('note');
      }
      setSaveError(missingField);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!selectedCard || saving) return;
    const now = new Date();
    const duplicate = transactions.some((transaction) => {
      const created = Date.parse(transaction.createdAt ?? '');
      return (
        created > 0 &&
        now.getTime() - created >= 0 &&
        now.getTime() - created <= 60_000 &&
        Math.abs(transaction.amount - parsedAmount) < 0.005 &&
        transaction.title.trim().toLocaleLowerCase() === trimmedMerchant.toLocaleLowerCase() &&
        transaction.accountId === selectedCard.id
      );
    });
    if (duplicate) {
      Alert.alert('Looks like a duplicate. Add anyway?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add anyway', onPress: () => { void saveTransaction(); } },
      ]);
      return;
    }
    await saveTransaction();
  };

  const saveTransaction = async () => {
    if (!selectedCard) return;
    setSaving(true);
    setSaveError('');
    const timestamp = date.toISOString();
    const transactionId = `transaction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = new Date().toISOString();
    const selectedCategory = categories.find((item) => item.name === category) ?? categories[0];
    const finalCategory = category ?? selectedCategory.name;
    const summaryDate = localDateTime(date);
    const transaction: Transaction = {
      id: transactionId,
      title: trimmedMerchant,
      subtitle: summaryDate,
      amount: parsedAmount,
      isPositive: mode === 'income',
      type: selectedCategory.homeType,
      mode,
      accountId: selectedCard.id,
      timestamp,
      createdAt,
      category: finalCategory,
      ...(initialTransaction?.tags ? { tags: initialTransaction.tags } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(attachment ? { attachment } : {}),
    };
    const walletTransactionId = `${transactionId}-account`;
    const walletTransaction: WalletTransaction = {
      id: walletTransactionId,
      merchant: trimmedMerchant,
      detail: summaryDate.replace(',', ' ·'),
      amount: parsedAmount,
      positive: mode === 'income',
      category: finalCategory,
      type: mode,
      timestamp,
      icon: selectedCategory.walletIcon,
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(attachment ? { attachment } : {}),
    };
    const balanceDelta = (mode === 'income' ? 1 : -1) * parsedAmount;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const monthlySpendDelta =
      mode === 'expense' && date >= monthStart && date < monthEnd ? parsedAmount : 0;
    try {
      await onSave(transaction, walletTransaction, balanceDelta, monthlySpendDelta);
      onSaved({
        transaction,
        accountId: selectedCard.id,
        walletTransactionId,
        balanceDelta,
        monthlySpendDelta,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch {
      setSaving(false);
      setSaveError("Couldn't save. Try again.");
    }
  };

  const symbol = formatWalletCurrency(0, selectedCard?.currency ?? 'INR').replace(/[\d.,\s]/g, '');
  const categoryPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: categoryPulse.value }],
  }));
  const handleCategorySelect = React.useCallback((nextCategory: string) => {
    setCategory(nextCategory);
    categoryPulse.value = withSequence(
      withTiming(1.04, { duration: 90 }),
      withTiming(1, { duration: 90 }),
    );
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [categoryPulse]);
  const updateCategoryManagerOverlay = React.useCallback((
    node: React.ReactNode | null,
    revision: string,
  ) => {
    setCategoryManagerOverlay((current) => (
      current?.revision === revision ? current : { revision, node }
    ));
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
    >
      <>
      <View style={styles.modalRoot}>
        <AnimatedReanimated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close transaction form"
          style={StyleSheet.absoluteFill}
          onPress={requestClose}
        />
        <TransactionSheetHost
          onLayout={(event) => {
            const nextHeight = event.nativeEvent.layout.height;
            if (nextHeight > 0) setAvailableHeight(nextHeight);
          }}
        >
          <AnimatedReanimated.View
            onLayout={(event) => {
              const measuredHeight = event.nativeEvent.layout.height;
              if (!visible || sheetAnimatedForOpen.current) return;
              sheetTranslateY.value = measuredHeight;
              sheetAnimatedForOpen.current = true;
              sheetTranslateY.value = reducedMotion
                ? withTiming(0, { duration: 180 })
                : withSpring(0, { damping: 60, stiffness: 180 });
            }}
            style={[
              styles.sheet,
              keyboardOpen && styles.keyboardExpandedSheet,
              {
                height: keyboardOpen ? availableHeight : sheetHeight,
                minHeight: keyboardOpen ? availableHeight : minSheetHeight,
                maxHeight: keyboardOpen ? availableHeight : maxSheetHeight,
              },
              sheetStyle,
            ]}
          >
            {/*
              Previous popup header retained as a commented reference:
              <View {...panResponder.panHandlers} style={styles.dragArea}>
                <View style={styles.handle} />
              </View>
              <View style={styles.heading}>
                <Text style={styles.title}>{mode === 'income' ? 'Add income' : 'Add expense'}</Text>
                <Text style={styles.requiredHint}>All fields are required</Text>
                <Pressable onPress={requestClose} style={styles.closeButton}>
                  <Feather name="x" size={20} color="#303039" />
                </Pressable>
              </View>
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressBar, { width: `${requiredProgress}%` }]} />
                </View>
                <Text style={styles.progressText}>{`${requiredCompleted}/${requiredTotal}`}</Text>
              </View>
            */}
            <LinearGradient
              colors={heroColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View {...panResponder.panHandlers} style={styles.dragArea}>
                <View style={styles.handle} />
              </View>
              <View style={styles.heading}>
                <View style={styles.titleWrap}>
                  {!keyboardOpen ? (
                    <View style={styles.heroEyebrowRow}>
                      <View style={styles.heroIcon}>
                        <Feather
                          name={mode === 'income' ? 'arrow-down-left' : 'arrow-up-right'}
                          size={16}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text style={styles.heroEyebrow}>
                        {mode === 'income' ? 'MONEY IN' : 'MONEY OUT'}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.title}>
                    {mode === 'income' ? 'Add income' : 'Add expense'}
                  </Text>
                  {!keyboardOpen ? (
                    <Text style={styles.requiredHint}>A little detail goes a long way</Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={requestClose}
                  style={styles.closeButton}
                >
                  <Feather name="x" size={20} color="#FFFFFF" />
                </Pressable>
              </View>

              {!keyboardOpen ? (
                <View style={styles.progressWrap} accessibilityLabel={`${requiredCompleted} of ${requiredTotal} fields completed`}>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressBar, { width: `${requiredProgress}%`, backgroundColor: '#FFFFFF' }]} />
                  </View>
                  <Text style={styles.progressText}>{`${requiredCompleted}/${requiredTotal}`}</Text>
                </View>
              ) : null}
            </LinearGradient>

            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                {
                  paddingHorizontal: 16 * scaleFactor,
                  paddingBottom: keyboardOpen ? Math.max(120, keyboardHeightRef.current * 0.35) : 12,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                scrollOffset.current = event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              <Text style={styles.label}>AMOUNT</Text>
              <View style={[styles.amountField, focusedField === 'amount' && { borderColor: accent }]}> 
                <Text style={[styles.currency, { color: accent }]}>{symbol}</Text>
                <TextInput
                  ref={amountRef}
                  accessibilityLabel="Transaction amount"
                  value={amount}
                  onChangeText={(value) => {
                    setAmount(groupedAmountInput(value));
                    setSaveError('');
                  }}
                  onFocus={() => {
                    setFocusedField('amount');
                    focusedFieldRef.current = 'amount';
                    focusScroll(amountRef);
                  }}
                  onBlur={() => {
                    setFocusedField(null);
                    focusedFieldRef.current = null;
                    setTouched((current) => ({ ...current, amount: true }));
                  }}
                  inputMode="decimal"
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  placeholder="0.00"
                  placeholderTextColor="#A0A0A5"
                  style={[
                    styles.amountInput,
                    {
                      color: accent,
                      fontSize: 40 * scaleFactor * Math.min(1, 14 / Math.max(14, amount.length)),
                    },
                  ]}
                  maxLength={18}
                  onSubmitEditing={() => merchantRef.current?.focus()}
                />
              </View>
              {activeError(amountError, 'amount')}

              <Text style={styles.label}>{mode === 'income' ? 'RECEIVED FROM' : 'PAID TO'}</Text>
              <TextInput
                ref={merchantRef}
                accessibilityLabel={mode === 'income' ? 'Received from' : 'Paid to'}
                value={merchant}
                onChangeText={(value) => {
                  setMerchant(value.slice(0, 40));
                  setSaveError('');
                }}
                onBlur={() => {
                  setTouched((current) => ({ ...current, merchant: true }));
                  setFocusedField(null);
                  focusedFieldRef.current = null;
                }}
                onFocus={() => {
                  setFocusedField('merchant');
                  focusedFieldRef.current = 'merchant';
                  focusScroll(merchantRef);
                }}
                maxLength={40}
                returnKeyType="next"
                placeholder={mode === 'income' ? 'Who sent this?' : 'Merchant or person'}
                placeholderTextColor="#9999A0"
                style={[styles.textInput, focusedField === 'merchant' && { borderWidth: 1, borderColor: accent }]}
              />
              {activeError(merchantError, 'merchant')}

              <Text style={styles.label}>DATE AND TIME</Text>
              <View style={styles.dateFields}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Date, ${date.toLocaleDateString()}`}
                  onPress={() => {
                    setPicker('date');
                    if (Platform.OS === 'ios') setIosPickerVisible(true);
                  }}
                  style={styles.dateField}
                >
                  <Feather name="calendar" size={17} color="#77777E" />
                  <Text numberOfLines={1} style={styles.dateText}>{date.toLocaleDateString()}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Time, ${date.toLocaleTimeString()}`}
                  onPress={() => {
                    setPicker('time');
                    if (Platform.OS === 'ios') setIosPickerVisible(true);
                  }}
                  style={styles.dateField}
                >
                  <Feather name="clock" size={17} color="#77777E" />
                  <Text style={styles.dateText}>{date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
                </Pressable>
              </View>
              {activeError(dateError, 'date')}
              {mode === 'income' && dateIsFuture && !keyboardOpen ? (
                <Text style={styles.warning}>This income is dated in the future.</Text>
              ) : null}
              {picker && Platform.OS === 'android' ? (
                <DateTimePicker
                  value={date}
                  mode={picker}
                  maximumDate={mode === 'expense' && picker === 'date' ? new Date() : undefined}
                  onChange={handlePickerChange}
                />
              ) : null}

              <Text style={styles.label}>{mode === 'income' ? 'DEPOSIT INTO' : 'PAY FROM'}</Text>
              {cards.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountRow}>
                  {cards.map((card) => {
                    const selected = accountId === card.id;
                    return (
                      <Pressable
                        key={card.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${getWalletCardDisplayName(card)}, ${card.number || 'Cash Wallet'}${selected ? ', selected' : ''}`}
                        accessibilityState={{ selected }}
                        onPress={() => {
                          Keyboard.dismiss();
                          setAccountId(card.id);
                        }}
                        style={[
                          styles.accountCard,
                          selected && styles.accountCardSelected,
                          selected && { borderColor: accent },
                        ]}
                      >
                        <LinearGradient
                          colors={card.colors}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.accountCardContent}>
                          <View style={styles.accountCardTop}>
                            <View style={styles.accountCardTitleWrap}>
                              <Text numberOfLines={1} style={styles.accountCardName}>
                                {getWalletCardDisplayName(card)}
                              </Text>
                              <Text style={styles.accountCardType}>
                                {getWalletCardTypeLabel(card)}
                              </Text>
                            </View>
                            <Feather name="wifi" size={18} color="rgba(255,255,255,0.82)" />
                          </View>
                          <View style={styles.accountCardBottom}>
                            <View>
                              <Text style={styles.accountCardNumber}>
                                {card.number
                                  ? `•••• ${card.number.replace(/\D/g, '').slice(-4)}`
                                  : 'CASH WALLET'}
                              </Text>
                              <Text style={styles.accountCardBalance}>
                                {formatWalletCurrency(card.balance, card.currency ?? 'INR')}
                              </Text>
                            </View>
                            {selected ? (
                              <View style={[styles.accountCardCheck, { backgroundColor: accent }]}>
                                <Feather name="check" size={13} color="#FFFFFF" />
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    close();
                    onAddCard();
                  }}
                  style={styles.addAccount}
                >
                  <Feather name="plus-circle" size={18} color={accent} />
                  <Text style={[styles.addAccountText, { color: accent }]}>Add a card first</Text>
                </Pressable>
              )}
              {mode === 'expense' && selectedCard && parsedAmount > selectedCard.balance && !keyboardOpen ? (
                <Text style={styles.warning}>This is more than the balance on this account.</Text>
              ) : null}

              <Text style={[styles.label, mode === 'expense' && styles.expenseCategoryLabel]}>CATEGORY</Text>
              <AnimatedReanimated.View style={categoryPulseStyle}>
                <CategoryPickerSheet
                  visible={visible}
                  inline
                  mode={mode}
                  selectedCategoryName={category ?? undefined}
                  onManagerOverlayChange={updateCategoryManagerOverlay}
                  onSelect={handleCategorySelect}
                  onClose={close}
                />
              </AnimatedReanimated.View>
              {activeError(categoryError, 'category')}

              <View style={styles.noteHeaderRow}>
                <Text style={styles.label}>NOTE</Text>
                <Text style={styles.counterText}>{`${Math.min(trimmedNote.length, 80)}/80`}</Text>
              </View>
              <TextInput
                ref={noteRef}
                accessibilityLabel="Note, required"
                value={note}
                onChangeText={(value) => {
                  setNote(value.slice(0, 80));
                  setSaveError('');
                }}
                onFocus={() => {
                  setFocusedField('note');
                  focusedFieldRef.current = 'note';
                  focusScroll(noteRef);
                }}
                onBlur={() => {
                  setFocusedField(null);
                  focusedFieldRef.current = null;
                  setTouched((current) => ({ ...current, note: true }));
                }}
                maxLength={80}
                multiline
                textAlignVertical="top"
                returnKeyType="done"
                placeholder="e.g. Monthly salary"
                placeholderTextColor="#9999A0"
                style={[styles.textInput, styles.noteInput, focusedField === 'note' && { borderWidth: 1, borderColor: accent }]}
              />
              {activeError(noteError, 'note')}
              <View style={styles.attachmentHeader}>
                <Text style={styles.label}>ATTACHMENT (OPTIONAL)</Text>
              </View>
              {attachment ? (
                <View style={styles.attachmentCard}>
                  <View style={styles.attachmentIcon}>
                    <Feather
                      name={attachment.mimeType === 'application/pdf' ? 'file-text' : 'image'}
                      size={17}
                      color={accent}
                    />
                  </View>
                  <Text numberOfLines={1} style={styles.attachmentName}>{attachment.name}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove attachment"
                    onPress={() => setAttachment(undefined)}
                    style={styles.attachmentRemove}
                  >
                    <Feather name="x" size={16} color="#727783" />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add optional image or PDF attachment"
                  onPress={() => { void addAttachment(); }}
                  style={styles.attachmentButton}
                >
                  <Feather name="paperclip" size={17} color={accent} />
                  <Text style={[styles.attachmentButtonText, { color: accent }]}>Add attachment</Text>
                  <Text style={styles.attachmentFileHint}>Image or PDF</Text>
                </Pressable>
              )}
              {saveError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{saveError}</Text> : null}
            </ScrollView>

            <View style={[styles.footer, { paddingHorizontal: 16 * scaleFactor, paddingBottom: footerBottomPadding }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: saving || !cards.length }}
                accessibilityHint={valid ? 'Save this transaction' : 'Tap to see missing fields'}
                onPress={() => { void executeSave(); }}
                style={[
                  styles.saveButton,
                  { backgroundColor: valid ? accent : '#D8D9DE' },
                  saving && styles.saveButtonDisabled,
                  !cards.length && styles.saveButtonDisabled,
                ]}
                disabled={saving || !cards.length}
              >
                <LinearGradient
                  colors={valid && cards.length
                    ? heroColors
                    : ['#A6A7AE', '#898B94']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveGradient}
                >
                  <Text style={styles.saveText}>
                    {saving ? 'Saving…' : valid ? (mode === 'income' ? 'Add income' : 'Add expense') : 'Complete all fields'}
                  </Text>
                  {valid && cards.length ? (
                    <Feather name="arrow-right" size={18} color="#FFFFFF" />
                  ) : null}
                </LinearGradient>
              </Pressable>
            </View>
          </AnimatedReanimated.View>
        </TransactionSheetHost>
      </View>
      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosPickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setIosPickerVisible(false);
            setPicker(null);
          }}
        >
          <View style={styles.pickerBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setIosPickerVisible(false);
                setPicker(null);
              }}
            />
            <View style={styles.pickerPanel}>
              <View style={styles.pickerHeader}>
                <Pressable onPress={() => {
                  setIosPickerVisible(false);
                  setPicker(null);
                }}>
                  <Text style={styles.pickerButton}>Cancel</Text>
                </Pressable>
                <Pressable onPress={() => {
                  setIosPickerVisible(false);
                  setPicker(null);
                }}>
                  <Text style={[styles.pickerButton, { color: accent }]}>Done</Text>
                </Pressable>
              </View>
              {picker ? (
                <DateTimePicker
                  value={date}
                  mode={picker}
                  display="spinner"
                  maximumDate={mode === 'expense' && picker === 'date' ? new Date() : undefined}
                  onChange={handlePickerChange}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
      {categoryManagerOverlay?.node}
      {discardConfirmationVisible ? (
        <View style={styles.discardBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keep editing transaction"
            onPress={() => setDiscardConfirmationVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.discardDialog}>
            <Text style={styles.discardTitle}>Discard this transaction?</Text>
            <Text style={styles.discardMessage}>Your entered details will be lost.</Text>
            <View style={styles.discardActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDiscardConfirmationVisible(false)}
                style={styles.discardCancelButton}
              >
                <Text style={styles.discardCancelText}>Keep editing</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={close}
                style={styles.discardConfirmButton}
              >
                <Text style={styles.discardConfirmText}>Discard</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
      </>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  hostContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#09111E',
  },
  discardBackdrop: {
    ...StyleSheet.absoluteFill,
    zIndex: 2000,
    elevation: 2000,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(9,17,30,0.42)',
  },
  discardDialog: {
    width: '100%',
    maxWidth: 360,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
  },
  discardTitle: {
    color: '#252B36',
    fontSize: 18,
    fontWeight: '700',
  },
  discardMessage: {
    marginTop: 8,
    color: '#737782',
    fontSize: 14,
    lineHeight: 20,
  },
  discardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  discardCancelButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F1F2F4',
  },
  discardCancelText: {
    color: '#303642',
    fontSize: 14,
    fontWeight: '600',
  },
  discardConfirmButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#C83B2D',
  },
  discardConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  /*
   * Legacy popup surface retained for reference:
   * sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32 },
   * amountField: { height: 68, borderRadius: 18, backgroundColor: '#F2F2F3' },
   * saveButton: { height: 56, borderRadius: 18, backgroundColor: accent },
   */
  sheet: {
    width: '100%',
    backgroundColor: '#F7F7F8',
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingTop: 0,
    overflow: 'hidden',
  },
  keyboardExpandedSheet: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  hero: {
    paddingBottom: 10,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
  },
  dragArea: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.44)',
  },
  heading: {
    paddingHorizontal: 22,
    paddingTop: 2,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrap: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  requiredHint: {
    marginTop: 1,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    lineHeight: 16,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  heroIcon: {
    width: 21,
    height: 21,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingBottom: 0,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    lineHeight: 14,
    minWidth: 30,
    textAlign: 'right',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 1,
    paddingBottom: 12,
  },
  label: {
    marginTop: 9,
    marginBottom: 5,
    color: '#737782',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.25,
  },
  expenseCategoryLabel: {
    marginTop: 5,
    marginBottom: 2,
  },
  amountField: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#E8E9ED',
    backgroundColor: '#FFFFFF',
    shadowColor: '#182033',
    shadowOpacity: 0.06,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  currency: {
    fontSize: 27,
    fontWeight: '500',
    marginRight: 7,
    letterSpacing: -1,
  },
  amountInput: {
    maxWidth: '82%',
    minWidth: 110,
    fontWeight: '700',
    padding: 0,
    includeFontPadding: false,
    textAlign: 'left',
    letterSpacing: -1.2,
  },
  dateFields: {
    flexDirection: 'row',
    gap: 8,
  },
  dateField: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E9ED',
    backgroundColor: '#FFFFFF',
  },
  dateText: {
    flexShrink: 1,
    color: '#303642',
    fontSize: 12,
    lineHeight: 16,
  },
  textInput: {
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    color: '#252B36',
    fontSize: 15,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: '#E8E9ED',
  },
  accountRow: {
    gap: 8,
    paddingVertical: 5,
    paddingLeft: 2,
    paddingRight: 20,
  },
  accountCard: {
    width: 174,
    height: 88,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#3D4656',
    shadowColor: '#111827',
    shadowOpacity: 0.13,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  accountCardSelected: {
    transform: [{ scale: 1.015 }],
    shadowOpacity: 0.22,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
  },
  accountCardContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  accountCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  accountCardTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  accountCardName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  accountCardType: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 0.9,
    marginTop: 3,
  },
  accountCardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  accountCardNumber: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
  },
  accountCardBalance: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 9,
    fontWeight: '500',
    marginTop: 3,
  },
  accountCardCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  warning: {
    color: '#A96812',
    fontSize: 11,
    marginTop: 6,
  },
  addAccount: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8E9ED',
  },
  addAccountText: {
    fontSize: 13,
    fontWeight: '600',
  },
  noteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  noteInput: {
    height: 66,
    paddingTop: 10,
    paddingBottom: 8,
  },
  attachmentHeader: {
    marginTop: 3,
  },
  attachmentButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#DADDE3',
    backgroundColor: '#FFFFFF',
  },
  attachmentButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  attachmentFileHint: {
    marginLeft: 'auto',
    color: '#888D97',
    fontSize: 11,
  },
  attachmentCard: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 8,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E4E6EA',
    backgroundColor: '#FFFFFF',
  },
  attachmentIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  attachmentName: {
    flex: 1,
    color: '#303642',
    fontSize: 12,
  },
  attachmentRemove: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F3F5',
  },
  counterText: {
    color: '#7A7A80',
    fontSize: 11,
    lineHeight: 14,
  },
  error: {
    color: '#B42318',
    fontSize: 11,
    marginTop: 5,
  },
  footer: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E6E9',
    backgroundColor: '#F7F7F8',
  },
  saveButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  saveGradient: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveButtonDisabled: {
    opacity: 0.42,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  pickerPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  pickerHeader: {
    height: 48,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E6E6E9',
  },
  pickerButton: {
    color: '#5D5D64',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default React.memo(TransactionSheet);
