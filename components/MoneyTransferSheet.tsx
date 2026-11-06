import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
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
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatWalletCurrency } from '../context/WalletCardsContext';
import { getWalletCardDisplayName, type WalletCard, type WalletTransaction } from '../data/walletCards';
import type { Transaction } from '../data/transactions';

type Props = {
  visible: boolean;
  cards: readonly WalletCard[];
  initialTransaction?: Transaction | null;
  onClose: () => void;
  onSave: (
    transaction: Transaction,
    sourceWalletTransaction: WalletTransaction,
    sourceAccountId: string,
    destinationAccountId: string | null,
    destinationWalletTransaction: WalletTransaction | null,
    monthlySpendDelta: number,
  ) => Promise<void>;
  onSaved: (transaction: Transaction) => void;
};

function localDateTime(date: Date) {
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

function MoneyTransferSheet({
  visible,
  cards,
  initialTransaction,
  onClose,
  onSave,
  onSaved,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const accountCardWidth = Math.max(128, Math.min(220, (width - 44) / 2));
  const [transferType, setTransferType] = React.useState<'self' | 'person'>('self');
  const [sourceId, setSourceId] = React.useState('');
  const [destinationId, setDestinationId] = React.useState('');
  const [recipient, setRecipient] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const progress = useSharedValue(0);
  const sourceCard = cards.find((card) => card.id === sourceId);
  const destinationCard = cards.find((card) => card.id === destinationId);
  const parsedAmount = Number(amount.replace(/,/g, ''));
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const recipientValid = transferType === 'self' || Boolean(recipient.trim());
  const destinationValid = transferType === 'person' ||
    (Boolean(destinationCard) && destinationCard?.id !== sourceCard?.id);
  const valid = amountValid && Boolean(sourceCard) && destinationValid && recipientValid;
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * height * 0.12 }],
  }));
  const selectedColor = '#E95738';

  React.useEffect(() => {
    if (!visible) return;
    const defaultSourceId = cards.find((card) => card.isDefault)?.id ?? cards[0]?.id ?? '';
    const sourceId = initialTransaction?.accountId &&
      cards.some((card) => card.id === initialTransaction.accountId)
      ? initialTransaction.accountId
      : defaultSourceId;
    const destinationId = initialTransaction?.destinationAccountId &&
      cards.some((card) => card.id === initialTransaction.destinationAccountId)
      ? initialTransaction.destinationAccountId
      : cards.find((card) => card.id !== sourceId)?.id ?? '';
    setTransferType(initialTransaction?.transferType ?? 'self');
    setSourceId(sourceId);
    setDestinationId(destinationId);
    setRecipient(initialTransaction?.transferType === 'person'
      ? initialTransaction.title.replace(/^(?:sent to|transfer to)\s*/i, '')
      : '');
    setAmount(initialTransaction ? String(initialTransaction.amount) : '');
    setNote(initialTransaction?.note ?? '');
    setError('');
    setSaving(false);
    progress.value = 0;
    progress.value = withTiming(1, { duration: 230 });
  }, [cards, initialTransaction, progress, visible]);

  const close = React.useCallback(() => {
    Keyboard.dismiss();
    progress.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [onClose, progress]);

  const save = async () => {
    if (!valid || !sourceCard || saving) {
      setError(
        !amountValid ? 'Enter an amount greater than zero.' :
          !sourceCard ? 'Choose an account to send from.' :
            !destinationValid ? 'Choose a different destination account.' :
              !recipientValid ? 'Enter the recipient name.' : '',
      );
      return;
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const walletTransactionId = `transfer-${Date.now()}`;
    const selfDestinationCard = transferType === 'self' ? destinationCard : undefined;
    const destinationName = selfDestinationCard
      ? getWalletCardDisplayName(selfDestinationCard)
      : recipient.trim();
    const title = selfDestinationCard
      ? `Transfer to ${destinationName}`
      : `Sent to ${destinationName}`;
    const dateLabel = localDateTime(now);
    const transaction: Transaction = {
      id: walletTransactionId,
      title,
      subtitle: `Today, ${now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
      amount: parsedAmount,
      isPositive: false,
      type: 'other',
      mode: 'expense',
      accountId: sourceCard.id,
      ...(selfDestinationCard ? { destinationAccountId: selfDestinationCard.id } : {}),
      transferType,
      category: 'Transfers',
      ...(note.trim() ? { note: note.trim() } : {}),
      timestamp,
      createdAt: timestamp,
    };
    const sourceWalletTransaction: WalletTransaction = {
      id: `${walletTransactionId}-out`,
      merchant: title,
      detail: dateLabel,
      amount: parsedAmount,
      positive: false,
      type: 'expense',
      category: 'Transfers',
      transferType,
      icon: 'swap-horizontal',
      ...(note.trim() ? { note: note.trim() } : {}),
      timestamp,
    };
    const destinationWalletTransaction: WalletTransaction | null = selfDestinationCard
      ? {
          id: `${walletTransactionId}-in`,
          merchant: `From ${getWalletCardDisplayName(sourceCard)}`,
          detail: dateLabel,
          amount: parsedAmount,
          positive: true,
          type: 'income',
          category: 'Transfers',
          transferType: 'self',
          icon: 'swap-horizontal',
          ...(note.trim() ? { note: note.trim() } : {}),
          timestamp,
        }
      : null;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthlySpendDelta = transferType === 'person' && now >= monthStart && now < monthEnd
      ? parsedAmount
      : 0;

    setSaving(true);
    setError('');
    try {
      await onSave(
        transaction,
        sourceWalletTransaction,
        sourceCard.id,
        selfDestinationCard?.id ?? null,
        destinationWalletTransaction,
        monthlySpendDelta,
      );
      onSaved(transaction);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch (saveError) {
      setSaving(false);
      setError(saveError instanceof Error ? saveError.message : 'Could not send money. Try again.');
    }
  };

  const renderAccountCard = (card: WalletCard, selected: boolean, onPress: () => void) => (
    <Pressable
      key={card.id}
      accessibilityRole="button"
      accessibilityLabel={`${getWalletCardDisplayName(card)}, ${card.number || 'Cash Wallet'}${selected ? ', selected' : ''}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.accountCard,
        { width: accountCardWidth },
        selected && { borderColor: selectedColor },
      ]}
    >
      <LinearGradient
        colors={card.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.accountCardContent}>
        <View style={styles.accountTop}>
          <Text numberOfLines={1} style={styles.accountName}>{getWalletCardDisplayName(card)}</Text>
          <Ionicons name="wifi" size={16} color="rgba(255,255,255,0.8)" />
        </View>
        <View style={styles.accountBottom}>
          <View>
            <Text style={styles.accountNumber}>
              {card.number ? `•••• ${card.number.replace(/\D/g, '').slice(-4)}` : 'CASH WALLET'}
            </Text>
            <Text style={styles.accountBalance}>
              {formatWalletCurrency(card.balance, card.currency ?? 'INR')}
            </Text>
          </View>
          {selected ? <View style={styles.accountCheck}><Feather name="check" size={11} color="#FFFFFF" /></View> : null}
        </View>
      </View>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.modalRoot}>
        <Pressable accessibilityLabel="Close send money" style={StyleSheet.absoluteFill} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardRoot}>
          <Animated.View
            style={[
              styles.sheet,
              {
                height: Math.min(height * 0.9, height - insets.top - 12),
                maxHeight: height - insets.top - 12,
                paddingBottom: Math.max(insets.bottom, 14),
              },
              sheetStyle,
            ]}
          >
            <LinearGradient colors={['#662118', '#B83C25', '#F05A3A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.handle} />
              <View style={styles.heroHeading}>
                <View style={styles.heroTextWrap}>
                  <View style={styles.eyebrowRow}>
                    <View style={styles.heroIcon}><Feather name="send" size={13} color="#FFFFFF" /></View>
                    <Text style={styles.eyebrow}>MOVE MONEY</Text>
                  </View>
                  <Text style={styles.title}>Send money</Text>
                  <Text style={styles.subtitle}>Choose where it comes from and where it goes.</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.closeButton}>
                  <Feather name="x" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            </LinearGradient>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              automaticallyAdjustKeyboardInsets
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.label}>TRANSFER TYPE</Text>
              <View style={styles.typeSwitch}>
                {([
                  ['self', 'Between my accounts', 'repeat'],
                  ['person', 'To someone', 'user'],
                ] as const).map(([type, label, icon]) => (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected: transferType === type }}
                    onPress={() => {
                      setTransferType(type);
                      setError('');
                    }}
                    style={[styles.typeOption, transferType === type && styles.typeOptionSelected]}
                  >
                    <Feather name={icon} size={14} color={transferType === type ? '#FFFFFF' : '#687080'} />
                    <Text style={[styles.typeText, transferType === type && styles.typeTextSelected]}>{label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>SEND FROM</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountRow}>
                {cards.map((card) => renderAccountCard(card, sourceId === card.id, () => {
                  setSourceId(card.id);
                  if (destinationId === card.id) setDestinationId(cards.find((item) => item.id !== card.id)?.id ?? '');
                  setError('');
                }))}
              </ScrollView>

              {transferType === 'self' ? (
                <>
                  <View style={styles.destinationHeading}>
                    <Text style={styles.label}>SEND TO</Text>
                    <Ionicons name="arrow-down" size={14} color="#8A909B" />
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.accountRow}>
                    {cards.filter((card) => card.id !== sourceId).map((card) =>
                      renderAccountCard(card, destinationId === card.id, () => {
                        setDestinationId(card.id);
                        setError('');
                      }),
                    )}
                  </ScrollView>
                  {cards.length < 2 ? <Text style={styles.helper}>Add another account to transfer between your own accounts.</Text> : null}
                </>
              ) : (
                <>
                  <Text style={styles.label}>RECIPIENT</Text>
                  <View style={styles.inputWrap}>
                    <Feather name="user" size={16} color="#858B96" />
                    <TextInput
                      accessibilityLabel="Recipient name"
                      value={recipient}
                      onChangeText={(value) => { setRecipient(value.slice(0, 40)); setError(''); }}
                      placeholder="Name of the person"
                      placeholderTextColor="#969BA5"
                      maxLength={40}
                      style={styles.input}
                      returnKeyType="next"
                    />
                  </View>
                </>
              )}

              <Text style={styles.label}>AMOUNT</Text>
              <View style={styles.amountWrap}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  accessibilityLabel="Transfer amount"
                  value={amount}
                  onChangeText={(value) => {
                    const clean = value.replace(/[^\d.]/g, '');
                    const [integer, ...fraction] = clean.split('.');
                    setAmount(`${integer}${fraction.length ? `.${fraction.join('').slice(0, 2)}` : ''}`);
                    setError('');
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#9AA0AA"
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  style={styles.amountInput}
                />
                {sourceCard ? <Text style={styles.available}>Available {formatWalletCurrency(sourceCard.balance, sourceCard.currency ?? 'INR')}</Text> : null}
              </View>

              <Text style={styles.label}>NOTE (OPTIONAL)</Text>
              <View style={styles.inputWrap}>
                <Feather name="file-text" size={16} color="#858B96" />
                <TextInput
                  accessibilityLabel="Transfer note"
                  value={note}
                  onChangeText={(value) => setNote(value.slice(0, 80))}
                  placeholder="What is this for?"
                  placeholderTextColor="#969BA5"
                  maxLength={80}
                  style={styles.input}
                  returnKeyType="done"
                />
              </View>
              {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !valid || saving }}
                onPress={() => { void save(); }}
                disabled={saving}
                style={styles.sendButton}
              >
                <LinearGradient
                  colors={valid ? ['#8E2D20', '#F05A3A'] : ['#A6A7AE', '#898B94']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.sendGradient}
                >
                  <Feather name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.sendText}>{saving ? 'Sending…' : 'Send money'}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9,17,30,0.5)',
  },
  keyboardRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#F7F7F8',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  hero: {
    paddingHorizontal: 22,
    paddingBottom: 17,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 3,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.42)',
    marginTop: 9,
    marginBottom: 13,
  },
  heroHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTextWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 12,
  },
  label: {
    color: '#707784',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.15,
    marginTop: 13,
    marginBottom: 7,
  },
  typeSwitch: {
    flexDirection: 'row',
    gap: 7,
  },
  typeOption: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6E8EC',
  },
  typeOptionSelected: {
    backgroundColor: '#253044',
    borderColor: '#253044',
  },
  typeText: {
    color: '#5D6572',
    fontSize: 11,
    fontWeight: '600',
  },
  typeTextSelected: {
    color: '#FFFFFF',
  },
  accountRow: {
    gap: 8,
    paddingVertical: 5,
    paddingRight: 18,
  },
  accountCard: {
    width: 164,
    height: 82,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#3D4656',
  },
  accountCardContent: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.13)',
  },
  accountTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  accountName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  accountBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  accountNumber: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  accountBalance: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 8,
    marginTop: 2,
  },
  accountCheck: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#E95738',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 5,
  },
  inputWrap: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6E8EC',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 44,
    color: '#252B36',
    fontSize: 13,
    paddingVertical: 0,
  },
  amountWrap: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E6E8EC',
    backgroundColor: '#FFFFFF',
  },
  currency: {
    color: '#E95738',
    fontSize: 24,
    fontWeight: '600',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    color: '#202735',
    fontSize: 23,
    fontWeight: '700',
    padding: 0,
  },
  available: {
    color: '#858B96',
    fontSize: 9,
  },
  helper: {
    color: '#858B96',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  error: {
    color: '#B42318',
    fontSize: 11,
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E3E5E9',
    backgroundColor: '#F7F7F8',
  },
  sendButton: {
    height: 52,
    borderRadius: 17,
    overflow: 'hidden',
  },
  sendGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  sendText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default React.memo(MoneyTransferSheet);
