import { Feather, Ionicons } from '@expo/vector-icons';
import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import React from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import CategoryGradientBadge from '../components/CategoryGradientBadge';
import CategoryPickerSheet from '../components/CategoryPickerSheet';
import {
  formatWalletCurrency,
  useWalletCards,
  type TransactionDeletionReceipt,
} from '../context/WalletCardsContext';
import { getWalletCardDisplayName } from '../data/walletCards';
import { transactionTimestamp, type Transaction } from '../data/transactions';
import theme from '../theme';
import {
  categoryFor,
  getTransactionMode,
  TRANSACTION_CATEGORY_COLORS,
} from '../utils/transactionCategories';
import { inferRecurringTransactionIds } from '../utils/activity';

type Props = {
  transactionId: string;
  onBack: () => void;
  onDuplicate: (transaction: Transaction) => void;
  onDeleted: (receipt: TransactionDeletionReceipt) => void;
  onOpenAccount: (cardId: string) => void;
};

function transactionDateLabel(transaction: Transaction) {
  const timestamp = transactionTimestamp(transaction);
  if (timestamp <= 0) return transaction.subtitle;
  const date = new Date(timestamp);
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dateLabel} · ${timeLabel}`;
}

function transactionPeriodLabel(date: Date, recurring: boolean) {
  const today = new Date();
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const delta = startOfDay(today) - startOfDay(date);
  const dayLabel = delta === 0
    ? 'Today'
    : delta === 24 * 60 * 60 * 1000
      ? 'Yesterday'
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${dayLabel} · ${recurring ? 'Repeats monthly' : 'One-off'}`;
}

function DetailRow({
  label,
  children,
  accessibilityLabel,
}: {
  label: string;
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}, ${accessibilityLabel}`}
      style={styles.detailRow}
    >
      <Text style={styles.detailRowLabel}>{label}</Text>
      <View style={styles.detailRowValue}>{children}</View>
    </View>
  );
}

function TransactionDetailsScreen({
  transactionId,
  onBack,
  onDuplicate,
  onDeleted,
  onOpenAccount,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const {
    transactions,
    cards,
    linkTransactionAccount,
    updateTransaction,
    editFinancialTransaction,
    deleteTransaction,
  } = useWalletCards();
  const [transactionSnapshot, setTransactionSnapshot] = React.useState<Transaction>();
  const transaction = transactions.find((item) => item.id === transactionId) ?? transactionSnapshot;
  const linkedCard = transaction?.accountId
    ? cards.find((item) => item.id === transaction.accountId)
    : undefined;
  const mode = transaction ? getTransactionMode(transaction) : 'expense';
  const category = transaction
    ? categoryFor(mode, transaction.category ?? 'Other')
    : categoryFor('expense', 'Other');
  const categoryColor = transaction
    ? TRANSACTION_CATEGORY_COLORS[transaction.category ?? ''] ?? theme.colors.categoryAccent
    : theme.colors.categoryAccent;
  const date = transaction && transactionTimestamp(transaction) > 0
    ? new Date(transactionTimestamp(transaction))
    : new Date();
  const recurringIds = React.useMemo(
    () => inferRecurringTransactionIds(transactions),
    [transactions],
  );
  const isRecurring = transaction
    ? transaction.isRecurring === true || recurringIds.has(transaction.id)
    : false;
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = React.useState(false);
  const [accountPickerVisible, setAccountPickerVisible] = React.useState(false);
  const [noteExpanded, setNoteExpanded] = React.useState(false);
  const [toastVisible, setToastVisible] = React.useState(false);
  const [toastText, setToastText] = React.useState('ID copied');
  const [editVisible, setEditVisible] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState('');
  const [editAmount, setEditAmount] = React.useState('');
  const [editNote, setEditNote] = React.useState('');
  const [editError, setEditError] = React.useState('');
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [viewerUri, setViewerUri] = React.useState<string | null>(null);
  const [cardHeight, setCardHeight] = React.useState(screenHeight * 0.75);
  const closing = React.useRef(false);
  const pendingDeletedReceipt = React.useRef<TransactionDeletionReceipt | null>(null);
  const translateY = useSharedValue(screenHeight);
  const scale = useSharedValue(reducedMotion ? 1 : 0.99);
  const backdropOpacity = useSharedValue(0);
  const menuProgress = useSharedValue(0);
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const completeClose = React.useCallback(() => {
    onBack();
    if (pendingDeletedReceipt.current) {
      onDeleted(pendingDeletedReceipt.current);
      pendingDeletedReceipt.current = null;
    }
  }, [onBack, onDeleted]);

  const finishClose = React.useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    cancelAnimation(translateY);
    if (reducedMotion) {
      backdropOpacity.value = withTiming(0, { duration: 160 }, (finished) => {
        if (finished) runOnJS(completeClose)();
      });
      return;
    }
    translateY.value = withTiming(screenHeight, { duration: 240 }, (finished) => {
      if (finished) runOnJS(completeClose)();
    });
    backdropOpacity.value = withTiming(0, { duration: 240 });
  }, [backdropOpacity, completeClose, reducedMotion, screenHeight, translateY]);

  React.useEffect(() => {
    closing.current = false;
    backdropOpacity.value = withTiming(1, { duration: reducedMotion ? 160 : 200 });
    if (reducedMotion) {
      translateY.value = 0;
      scale.value = 1;
    } else {
      translateY.value = screenHeight;
      scale.value = 0.99;
      translateY.value = withSpring(0, { damping: 30, stiffness: 180 });
      scale.value = withSpring(1, { damping: 30, stiffness: 180 });
    }
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [backdropOpacity, reducedMotion, scale, screenHeight, translateY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? backdropOpacity.value : 1,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }), [reducedMotion]);
  const menuStyle = useAnimatedStyle(() => ({
    opacity: menuProgress.value,
    transform: [{ scale: 0.96 + menuProgress.value * 0.04 }],
  }));
  React.useEffect(() => {
    menuProgress.value = withTiming(menuVisible ? 1 : 0, { duration: 140 });
  }, [menuProgress, menuVisible]);
  const panGesture = React.useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .failOffsetX([-18, 18])
        .onUpdate((event) => {
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (
            event.translationY > cardHeight * 0.25 ||
            event.velocityY > 800
          ) {
            runOnJS(finishClose)();
          } else {
            translateY.value = withSpring(0, { damping: 20, stiffness: 180 });
          }
        }),
    [cardHeight, finishClose, translateY],
  );

  const copyText = React.useCallback(async (value: string, label: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setToastText(label);
      setToastVisible(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Could not copy transaction details.', error);
      Alert.alert('Could not copy', 'Please try again.');
    }
  }, []);

  const applyAccountLink = React.useCallback(async (accountId: string) => {
    if (!transaction) return;
    try {
      await linkTransactionAccount(transaction.id, accountId);
      setAccountPickerVisible(false);
      setToastText('Account linked');
      setToastVisible(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Could not link transaction to account.', error);
      Alert.alert('Could not link account', 'Please try again.');
    }
  }, [linkTransactionAccount, transaction]);

  const linkAccount = React.useCallback(
    (accountId: string) => {
      if (!transaction) return;
      const account = cards.find((item) => item.id === accountId);
      if (!account) {
        Alert.alert('Account unavailable', 'Choose an account that is still available.');
        return;
      }
      if (Platform.OS === 'web') {
        void applyAccountLink(accountId);
        return;
      }
      Alert.alert(
        'Link to this account?',
        'Balances won’t change.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Link account', onPress: () => void applyAccountLink(accountId) },
        ],
      );
    },
    [applyAccountLink, cards, transaction],
  );

  const chooseAttachment = React.useCallback(async () => {
    if (!transaction) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const attachment = result.assets[0];
      await updateTransaction(transaction.id, {
        attachment: {
          name: attachment.name,
          uri: attachment.uri,
          ...(attachment.mimeType ? { mimeType: attachment.mimeType } : {}),
          ...(attachment.size !== undefined ? { size: attachment.size } : {}),
        },
      });
      setToastText('Receipt attached');
      setToastVisible(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
    } catch (error) {
      console.error('Could not select transaction receipt.', error);
      Alert.alert('Could not attach receipt', 'Please try again.');
    }
  }, [transaction, updateTransaction]);

  const shareSummary = React.useCallback(async () => {
    if (!transaction) return;
    const summary = [
      transaction.title,
      `${mode === 'expense' ? 'Expense' : 'Income'} · ${formatWalletCurrency(transaction.amount, 'INR')}`,
      transactionDateLabel(transaction),
      transaction.category ?? category.name,
      transaction.note,
    ].filter(Boolean).join('\n');
    try {
      if (transaction.attachment?.uri && Platform.OS !== 'web') {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(transaction.attachment.uri, {
            dialogTitle: 'Share receipt',
            mimeType: transaction.attachment.mimeType,
            UTI: transaction.attachment.mimeType,
          });
          return;
        }
      }
      await Share.share({ message: summary, title: 'Transaction receipt' });
    } catch (error) {
      console.error('Could not share transaction receipt.', error);
      Alert.alert('Could not share receipt', 'Please try again.');
    }
  }, [category.name, mode, transaction]);

  const saveEdit = React.useCallback(async () => {
    if (!transaction) return;
    const parsedAmount = Number(editAmount.replace(/[₹,\s]/g, ''));
    if (!editTitle.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setEditError('Enter a merchant name and a valid amount.');
      return;
    }
    setSavingEdit(true);
    setEditError('');
    try {
      await editFinancialTransaction(transaction.id, {
        title: editTitle.trim(),
        amount: parsedAmount,
        note: editNote.trim() || undefined,
      });
      setEditVisible(false);
      setToastText('Transaction updated');
      setToastVisible(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Could not edit transaction.', error);
      setEditError(error instanceof Error ? error.message : 'Could not save changes.');
    } finally {
      setSavingEdit(false);
    }
  }, [editAmount, editNote, editTitle, editFinancialTransaction, transaction]);

  const openEditSheet = React.useCallback(() => {
    if (!transaction) return;
    setEditTitle(transaction.title);
    setEditAmount(String(transaction.amount));
    setEditNote(transaction.note ?? '');
    setEditError('');
    setEditVisible(true);
  }, [transaction]);

  const selectCategory = React.useCallback(async (categoryName: string) => {
    if (!transaction) return;
    try {
      await updateTransaction(transaction.id, { category: categoryName });
      setCategoryPickerVisible(false);
      setToastText('Category updated');
      setToastVisible(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastVisible(false), 1800);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Could not update transaction category.', error);
      Alert.alert('Could not update category', 'Please try again.');
    }
  }, [transaction, updateTransaction]);

  const confirmDelete = React.useCallback(() => {
    if (!transaction) return;
    setTransactionSnapshot(transaction);
    Alert.alert(
      'Delete this transaction?',
      'The account balance will be adjusted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteTransaction(transaction.id)
              .then((receipt) => {
                pendingDeletedReceipt.current = receipt;
                finishClose();
              })
              .catch((error: unknown) => {
                console.error('Could not delete transaction.', error);
                setTransactionSnapshot(undefined);
                Alert.alert('Could not delete transaction', 'Please try again.');
              });
          },
        },
      ],
    );
  }, [deleteTransaction, finishClose, onDeleted, transaction]);

  if (!transaction) {
    return (
      <Modal
        visible
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={onBack}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onBack}
            style={styles.backdrop}
          />
          <View style={styles.notFoundCard}>
            <Text style={styles.notFoundText}>This transaction is no longer available.</Text>
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  const amount = `${mode === 'income' ? '+' : '−'}${formatWalletCurrency(transaction.amount, 'INR')}`;
  const cardAccountName = linkedCard
    ? `${getWalletCardDisplayName(linkedCard)}${linkedCard.number
      ? ` ···${linkedCard.number.replace(/\D/g, '').slice(-4)}`
      : ''}`
    : undefined;
  const tags = transaction.tags?.filter(Boolean) ?? [];
  const shortId = transaction.id.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase();
  const modalBottom = insets.bottom + theme.spacing.md;
  const maxCardHeight = Math.min(screenHeight * 0.88, screenHeight - insets.top - theme.spacing.xl);

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={finishClose}
    >
      <View style={styles.modalRoot}>
        <StatusBar style="light" />
        <NavigationBar style="light" />
        <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={finishClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
          style={[
            styles.card,
            {
              width: Math.max(0, screenWidth - theme.spacing.md * 2),
              maxHeight: maxCardHeight,
              marginBottom: modalBottom,
            },
            cardStyle,
          ]}
        >
          <GestureDetector gesture={panGesture}>
            <View style={styles.dragHeader}>
              <View style={styles.dragHandle} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Transaction options"
                hitSlop={theme.spacing.md}
                onPress={() => setMenuVisible((visible) => !visible)}
                style={styles.menuButton}
              >
                <Feather name="more-horizontal" size={19} color={theme.colors.text} />
              </Pressable>
            </View>
          </GestureDetector>

          {menuVisible ? (
            <Animated.View
              accessibilityElementsHidden={!menuVisible}
              importantForAccessibility="auto"
              style={[styles.menuPopover, menuStyle]}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMenuVisible(false);
                  void shareSummary();
                }}
                style={styles.menuItem}
              >
                <Feather name="share-2" size={16} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Share receipt</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMenuVisible(false);
                  onDuplicate(transaction);
                  finishClose();
                }}
                style={styles.menuItem}
              >
                <Feather name="copy" size={16} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Duplicate</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMenuVisible(false);
                  void shareSummary();
                }}
                style={styles.menuItem}
              >
                <Feather name="copy" size={16} color={theme.colors.text} />
                <Text style={styles.menuItemText}>Copy details</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMenuVisible(false);
                  confirmDelete();
                }}
                style={styles.menuItem}
              >
                <Feather name="trash-2" size={16} color={theme.colors.deleteAccent} />
                <Text style={styles.deleteMenuText}>Delete</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <GestureDetector gesture={panGesture}>
              <View style={styles.hero}>
                <CategoryGradientBadge color={categoryColor} icon={category.icon} size={68} />
                <Text style={styles.counterpartyLabel}>
                  {mode === 'income' ? 'RECEIVED FROM' : 'PAID TO'}
                </Text>
                <Text style={styles.merchant} numberOfLines={2}>
                  {transaction.title}
                </Text>
                <Text
                  accessibilityLabel={`${mode === 'income' ? 'Income' : 'Expense'}, ${formatWalletCurrency(transaction.amount, 'INR').replace(/[^\d.,]/g, '')} rupees, ${mode === 'income' ? 'received from' : 'paid to'} ${transaction.title}, ${transactionPeriodLabel(date, isRecurring)}`}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                  numberOfLines={1}
                  style={[styles.amount, mode === 'income' && styles.incomeAmount]}
                >
                  {amount}
                </Text>
                <Text style={styles.subtitle}>{transactionPeriodLabel(date, isRecurring)}</Text>
                <View style={[styles.modePill, mode === 'income' ? styles.incomePill : styles.expensePill]}>
                  <Text style={[styles.modePillText, mode === 'income' ? styles.incomeText : styles.expenseText]}>
                    {mode === 'income' ? 'INCOME' : 'EXPENSE'}
                  </Text>
                </View>
              </View>
            </GestureDetector>

            <View style={styles.sectionDivider} />
            <View style={styles.rows}>
              <DetailRow label="Category" accessibilityLabel={transaction.category ?? category.name}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Change category, currently ${transaction.category ?? category.name}`}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCategoryPickerVisible(true);
                  }}
                  style={styles.categoryPill}
                >
                  <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
                  <Text numberOfLines={2} style={styles.categoryText}>
                    {transaction.category ?? category.name}
                  </Text>
                  <Feather name="chevron-right" size={14} color={theme.colors.transactionModalMuted} />
                </Pressable>
              </DetailRow>
              <View style={styles.rowDivider} />
              <DetailRow
                label="Account"
                accessibilityLabel={cardAccountName ?? 'Not linked'}
              >
                {cardAccountName ? (
                  <View style={styles.accountLinkedValue}>
                    <View style={[styles.accountDot, { backgroundColor: linkedCard?.colors[0] ?? theme.colors.activityMuted }]} />
                    <Text numberOfLines={2} style={styles.valueText}>{cardAccountName}</Text>
                  </View>
                ) : (
                  <View style={styles.accountActions}>
                    <Text style={styles.mutedValue}>Not linked</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Choose an account"
                      onPress={() => setAccountPickerVisible(true)}
                      hitSlop={theme.spacing.sm}
                    >
                      <Text style={styles.chooseLink}>Choose</Text>
                    </Pressable>
                  </View>
                )}
              </DetailRow>
              <View style={styles.rowDivider} />
              <DetailRow label="Date & time" accessibilityLabel={transactionDateLabel(transaction)}>
                <Text numberOfLines={2} style={styles.valueText}>{transactionDateLabel(transaction)}</Text>
              </DetailRow>
              {tags.length > 0 ? (
                <>
                  <View style={styles.rowDivider} />
                  <DetailRow label="Tags" accessibilityLabel={tags.join(', ')}>
                    <Text numberOfLines={2} style={styles.valueText}>{tags.join(', ')}</Text>
                  </DetailRow>
                </>
              ) : null}
              <View style={styles.rowDivider} />
              <DetailRow label="Note" accessibilityLabel={transaction.note ?? 'No note'}>
                {transaction.note ? (
                  <Text
                    numberOfLines={noteExpanded ? undefined : 3}
                    style={styles.valueText}
                  >
                    {transaction.note}
                  </Text>
                ) : (
                  <Text style={styles.mutedValue}>No note</Text>
                )}
                {transaction.note && transaction.note.length > 120 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setNoteExpanded((expanded) => !expanded)}
                  >
                    <Text style={styles.chooseLink}>{noteExpanded ? 'Show less' : 'Show more'}</Text>
                  </Pressable>
                ) : null}
              </DetailRow>
            </View>

            <View style={styles.receiptSection}>
              <Text style={styles.sectionLabel}>RECEIPT</Text>
              {transaction.attachment ? (
                <View style={styles.attachmentList}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open receipt ${transaction.attachment.name}`}
                    onPress={() => {
                      if (!transaction.attachment?.uri) return;
                      if (transaction.attachment.mimeType?.startsWith('image/')) {
                        setViewerUri(transaction.attachment.uri);
                        return;
                      }
                      void Linking.openURL(transaction.attachment.uri).catch((error: unknown) => {
                        console.error('Could not open transaction receipt.', error);
                        Alert.alert('Could not open receipt', 'Please try again.');
                      });
                    }}
                    style={styles.attachmentTile}
                  >
                    {transaction.attachment.mimeType?.startsWith('image/') ? (
                      <Image
                        source={{ uri: transaction.attachment.uri }}
                        resizeMode="cover"
                        style={styles.attachmentImage}
                      />
                    ) : (
                      <>
                        <Ionicons
                          name="document-text-outline"
                          size={20}
                          color={theme.colors.transactionModalMuted}
                        />
                        <Text numberOfLines={2} style={styles.attachmentName}>
                          {transaction.attachment.name}
                        </Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add another receipt"
                    onPress={() => void chooseAttachment()}
                    style={styles.addReceiptTile}
                  >
                    <Feather name="plus" size={20} color={theme.colors.transactionModalMuted} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Attach receipt photo or PDF"
                  onPress={() => void chooseAttachment()}
                  style={styles.emptyReceipt}
                >
                  <Feather name="plus" size={20} color={theme.colors.transactionModalMuted} />
                  <Text style={styles.receiptTitle}>RECEIPT SCAN</Text>
                  <Text style={styles.receiptSubtitle}>Tap to attach a photo</Text>
                </Pressable>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Copy transaction ID ${shortId}`}
              onPress={() => {
                void copyText(shortId, 'ID copied');
              }}
              style={styles.transactionId}
            >
              <Text style={styles.transactionIdText}>ID {shortId} · Tap to copy</Text>
            </Pressable>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: theme.spacing.sm }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close transaction details"
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                finishClose();
              }}
              style={({ pressed }) => [styles.closeButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit transaction"
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                openEditSheet();
              }}
              style={({ pressed }) => [styles.editButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </View>
        </Animated.View>

        {categoryPickerVisible ? (
          <CategoryPickerSheet
            visible={categoryPickerVisible}
            mode={mode}
            selectedCategoryName={transaction?.category ?? undefined}
            onSelect={(categoryName) => {
              void selectCategory(categoryName);
            }}
            onClose={() => setCategoryPickerVisible(false)}
          />
        ) : null}

        {accountPickerVisible ? (
          <Modal
            visible
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={() => setAccountPickerVisible(false)}
          >
            <View style={styles.accountModalRoot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close account list"
                onPress={() => setAccountPickerVisible(false)}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.accountPicker, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
                <View style={styles.accountHandle} />
                <Text style={styles.accountPickerTitle}>Choose account</Text>
                <ScrollView style={styles.accountList} showsVerticalScrollIndicator={false}>
                  {cards.map((account) => (
                    <Pressable
                      key={account.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Link to ${getWalletCardDisplayName(account)}`}
                      onPress={() => linkAccount(account.id)}
                      style={styles.accountOption}
                    >
                      <View style={[styles.accountDot, { backgroundColor: account.colors[0] }]} />
                      <View style={styles.accountOptionText}>
                        <Text style={styles.accountName}>{getWalletCardDisplayName(account)}</Text>
                        <Text style={styles.accountNumber}>
                          {account.number ? `···${account.number.replace(/\D/g, '').slice(-4)}` : account.type}
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={theme.colors.transactionModalMuted} />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        ) : null}

        {editVisible ? (
          <Modal
            visible
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={() => setEditVisible(false)}
          >
            <View style={styles.editModalRoot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close edit transaction"
                onPress={() => setEditVisible(false)}
                style={StyleSheet.absoluteFill}
              />
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.editHost}
              >
                <View style={[styles.editSheet, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
                  <View style={styles.accountHandle} />
                  <Text style={styles.editHeading}>Edit transaction</Text>
                  <Text style={styles.editFieldLabel}>MERCHANT</Text>
                  <TextInput
                    accessibilityLabel="Merchant"
                    value={editTitle}
                    onChangeText={setEditTitle}
                    maxLength={40}
                    style={styles.editInput}
                    returnKeyType="next"
                  />
                  <Text style={styles.editFieldLabel}>AMOUNT</Text>
                  <TextInput
                    accessibilityLabel="Amount"
                    value={editAmount}
                    onChangeText={setEditAmount}
                    keyboardType="decimal-pad"
                    style={styles.editInput}
                  />
                  <Text style={styles.editFieldLabel}>NOTE</Text>
                  <TextInput
                    accessibilityLabel="Note"
                    value={editNote}
                    onChangeText={setEditNote}
                    multiline
                    maxLength={500}
                    style={[styles.editInput, styles.editNoteInput]}
                  />
                  {editError ? (
                    <Text accessibilityLiveRegion="polite" style={styles.editError}>{editError}</Text>
                  ) : null}
                  <View style={styles.editActions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => setEditVisible(false)}
                      style={styles.closeButton}
                    >
                      <Text style={styles.closeButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={savingEdit}
                      onPress={() => void saveEdit()}
                      style={[styles.editButton, savingEdit && styles.disabledButton]}
                    >
                      <Text style={styles.editButtonText}>{savingEdit ? 'Saving…' : 'Save changes'}</Text>
                    </Pressable>
                  </View>
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>
        ) : null}

        {viewerUri ? (
          <Modal
            visible
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setViewerUri(null)}
          >
            <View style={styles.viewerRoot}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close receipt viewer"
                onPress={() => setViewerUri(null)}
                style={[styles.viewerClose, { top: insets.top + theme.spacing.lg }]}
              >
                <Feather name="x" size={22} color={theme.colors.white} />
              </Pressable>
              <Image
                accessibilityLabel="Transaction receipt"
                source={{ uri: viewerUri }}
                resizeMode="contain"
                style={styles.viewerImage}
              />
            </View>
          </Modal>
        ) : null}

        {toastVisible ? (
          <View pointerEvents="none" style={[styles.toast, { bottom: modalBottom + theme.spacing.md }]}>
            <Text style={styles.toastText}>{toastText}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.colors.transactionModalBackdrop,
    zIndex: 0,
  },
  card: {
    flexShrink: 1,
    overflow: 'visible',
    borderRadius: theme.radii.transactionModal,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    backgroundColor: theme.colors.transactionModalSurface,
    zIndex: 2,
    ...theme.shadows.transactionModal,
  },
  dragHeader: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.transactionModalHandle,
  },
  menuButton: {
    position: 'absolute',
    top: 4,
    right: 0,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.transactionModalMenu,
  },
  menuPopover: {
    position: 'absolute',
    top: theme.spacing.xl,
    right: theme.spacing.lg,
    zIndex: 5,
    minWidth: 180,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.transactionCategory,
    backgroundColor: theme.colors.white,
    ...theme.shadows.activityCard,
  },
  menuItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  menuItemText: {
    color: theme.colors.text,
    ...theme.typography.transactionModalMenuItem,
  },
  deleteMenuText: {
    color: theme.colors.deleteAccent,
    ...theme.typography.transactionModalMenuItem,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.md,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
  },
  counterpartyLabel: {
    marginTop: theme.spacing.md,
    color: theme.colors.transactionModalMuted,
    ...theme.typography.transactionLabel,
  },
  merchant: {
    width: '100%',
    marginTop: theme.spacing.xxs,
    color: theme.colors.text,
    ...theme.typography.transactionModalMerchant,
    textAlign: 'center',
  },
  amount: {
    width: '100%',
    marginTop: theme.spacing.xs,
    color: theme.colors.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    ...theme.typography.transactionModalAmount,
  },
  incomeAmount: {
    color: theme.colors.activityIncome,
  },
  subtitle: {
    marginTop: theme.spacing.xxs,
    color: theme.colors.transactionModalMuted,
    ...theme.typography.transactionModalCaption,
    textAlign: 'center',
  },
  modePill: {
    minHeight: 22,
    marginTop: theme.spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  incomePill: {
    backgroundColor: theme.colors.transactionIncomePill,
  },
  expensePill: {
    backgroundColor: theme.colors.transactionExpensePill,
  },
  modePillText: {
    ...theme.typography.transactionModalPill,
  },
  incomeText: {
    color: theme.colors.activityIncome,
  },
  expenseText: {
    color: theme.colors.categoryAccent,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.transactionModalDivider,
  },
  rows: {
    paddingTop: theme.spacing.xs,
  },
  detailRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  detailRowLabel: {
    flex: 0.8,
    color: theme.colors.text,
    ...theme.typography.transactionModalRowLabel,
  },
  detailRowValue: {
    flex: 1.2,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
    minWidth: 0,
  },
  valueText: {
    color: theme.colors.transactionModalMuted,
    textAlign: 'right',
    ...theme.typography.transactionModalRowValue,
  },
  mutedValue: {
    color: theme.colors.activityMuted,
    textAlign: 'right',
    ...theme.typography.transactionModalRowValue,
  },
  accountActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  accountLinkedValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing.xs,
  },
  chooseLink: {
    color: theme.colors.text,
    ...theme.typography.transactionModalLink,
  },
  categoryPill: {
    maxWidth: '100%',
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.transactionCategory,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.transactionModalBorder,
    backgroundColor: theme.colors.white,
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: theme.radii.pill,
  },
  categoryText: {
    flexShrink: 1,
    color: theme.colors.text,
    ...theme.typography.transactionModalCategory,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.transactionModalDivider,
  },
  receiptSection: {
    paddingTop: theme.spacing.sm,
  },
  sectionLabel: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.transactionModalMuted,
    ...theme.typography.transactionModalSectionLabel,
  },
  emptyReceipt: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.transactionModalTileBorder,
    borderRadius: theme.radii.transactionReceipt,
    backgroundColor: theme.colors.transactionModalTileBackground,
  },
  receiptTitle: {
    marginTop: theme.spacing.xxs,
    color: theme.colors.transactionModalMuted,
    ...theme.typography.transactionModalReceiptTitle,
  },
  receiptSubtitle: {
    marginTop: 1,
    color: theme.colors.text,
    ...theme.typography.transactionModalReceiptSubtitle,
  },
  attachmentTile: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderRadius: theme.radii.transactionReceipt,
    backgroundColor: theme.colors.transactionModalTileBackground,
  },
  attachmentList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  addReceiptTile: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.transactionModalTileBorder,
    borderRadius: theme.radii.transactionReceipt,
    backgroundColor: theme.colors.transactionModalTileBackground,
  },
  attachmentName: {
    marginTop: theme.spacing.xs,
    color: theme.colors.transactionModalMuted,
    textAlign: 'center',
    ...theme.typography.transactionModalAttachmentName,
  },
  transactionId: {
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  transactionIdText: {
    color: theme.colors.transactionModalMuted,
    textAlign: 'center',
    ...theme.typography.transactionId,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.transactionModalDivider,
  },
  closeButton: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.action,
    borderWidth: 1,
    borderColor: theme.colors.transactionModalBorder,
    backgroundColor: theme.colors.white,
  },
  closeButtonText: {
    color: theme.colors.text,
    ...theme.typography.transactionModalAction,
  },
  editButton: {
    flex: 1,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.action,
    backgroundColor: theme.colors.primary,
    ...theme.shadows.transactionModalAction,
  },
  editButtonText: {
    color: theme.colors.white,
    ...theme.typography.transactionModalAction,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  accountModalRoot: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.transactionModalBackdrop,
    zIndex: 1100,
    elevation: 1100,
  },
  editModalRoot: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.transactionModalBackdrop,
    zIndex: 1200,
    elevation: 1200,
  },
  editHost: {
    justifyContent: 'flex-end',
  },
  editSheet: {
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderTopLeftRadius: theme.radii.sheetTop,
    borderTopRightRadius: theme.radii.sheetTop,
    backgroundColor: theme.colors.transactionModalSurface,
  },
  editHeading: {
    marginBottom: theme.spacing.lg,
    color: theme.colors.text,
    ...theme.typography.transactionHeader,
  },
  editFieldLabel: {
    marginBottom: theme.spacing.xs,
    color: theme.colors.transactionModalMuted,
    ...theme.typography.transactionLabel,
  },
  editInput: {
    minHeight: 48,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.transactionModalBorder,
    borderRadius: theme.radii.input,
    color: theme.colors.text,
    backgroundColor: theme.colors.white,
    ...theme.typography.transactionModalRowValue,
  },
  editNoteInput: {
    minHeight: 88,
    paddingTop: theme.spacing.md,
    textAlignVertical: 'top',
  },
  editError: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.deleteAccent,
    ...theme.typography.transactionModalCaption,
  },
  editActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  disabledButton: {
    opacity: 0.6,
  },
  viewerRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.transactionModalViewer,
  },
  viewerClose: {
    position: 'absolute',
    right: theme.spacing.lg,
    zIndex: 1,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.transactionModalMenu,
  },
  viewerImage: {
    width: '100%',
    height: '100%',
  },
  accountPicker: {
    maxHeight: '70%',
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderTopLeftRadius: theme.radii.sheetTop,
    borderTopRightRadius: theme.radii.sheetTop,
    backgroundColor: theme.colors.transactionModalSurface,
  },
  accountHandle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.transactionModalHandle,
  },
  accountPickerTitle: {
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
    ...theme.typography.transactionModalAccountTitle,
  },
  accountList: {
    flexShrink: 1,
  },
  accountOption: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.transactionModalDivider,
  },
  accountDot: {
    width: 12,
    height: 12,
    borderRadius: theme.radii.pill,
  },
  accountOptionText: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  accountName: {
    color: theme.colors.text,
    ...theme.typography.transactionModalAccountName,
  },
  accountNumber: {
    color: theme.colors.transactionModalMuted,
    ...theme.typography.transactionModalAccountMeta,
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 1200,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary,
    elevation: 25,
  },
  toastText: {
    color: theme.colors.white,
    ...theme.typography.transactionModalToast,
  },
  notFoundCard: {
    width: '90%',
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
    borderRadius: theme.radii.transactionModal,
    backgroundColor: theme.colors.transactionModalSurface,
    ...theme.shadows.transactionModal,
  },
  notFoundText: {
    marginBottom: theme.spacing.lg,
    color: theme.colors.text,
    textAlign: 'center',
    ...theme.typography.transactionModalAction,
  },
});

export default React.memo(TransactionDetailsScreen);
