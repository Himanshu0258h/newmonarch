import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
import { Feather, Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import type { WalletCard } from '../../data/walletCards';
import { hasDuplicateCard, validateCardDraft, type CardDraft } from '../../utils/cardValidation';
import ColorPalette, { CARD_PALETTES } from './ColorPalette';
import NetworkPicker, { type CardNetwork } from './NetworkPicker';

type Props = {
  visible: boolean;
  cards: readonly WalletCard[];
  card: WalletCard | null;
  onClose: () => void;
  onSave: (
    draft: CardDraft,
    colors: readonly [string, string, string],
    originalCard: WalletCard | null,
    onSaved: () => void,
  ) => void;
  renderPreview: (card: WalletCard) => React.ReactNode;
};

const SUGGESTIONS = [
  'HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak', 'PNB', 'Yes Bank', 'IDFC First', 'Bank of Baroda',
];

function getPalette(card: WalletCard | null, cards: readonly WalletCard[]) {
  if (card) {
    const palette = CARD_PALETTES.find((item) => item.colors[0] === card.colors[0]);
    return {
      name: palette?.name ?? 'Custom',
      colors: [
        card.colors[0],
        card.colors[1] ?? card.colors[0],
        card.colors[2] ?? card.colors[1] ?? card.colors[0],
      ] as const,
    };
  }
  const unused = CARD_PALETTES.find(
    (palette) => !cards.some((existing) => existing.colors[0] === palette.colors[0]),
  ) ?? CARD_PALETTES[0];
  return { name: unused.name, colors: unused.colors };
}

function formatBalanceInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, '');
  const decimalIndex = normalized.indexOf('.');
  const integerPart = (decimalIndex < 0 ? normalized : normalized.slice(0, decimalIndex))
    .replace(/^0+(?=\d)/, '');
  const fraction = decimalIndex < 0
    ? ''
    : `.${normalized.slice(decimalIndex + 1).replace(/\./g, '').slice(0, 2)}`;
  const grouped = integerPart
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(integerPart))
    : '';
  return `${grouped}${fraction}`;
}

function currencySymbol(currencyCode: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? '₹';
}

function AddCardSheet({
  visible,
  cards,
  card,
  onClose,
  onSave,
  renderPreview,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const cashWallet = card?.id === 'cash-wallet';
  const initialPalette = React.useMemo(() => getPalette(card, cards), [card, cards]);
  const [bank, setBank] = React.useState(card?.bank ?? '');
  const [holder, setHolder] = React.useState(card?.holder ?? '');
  const [accountNumber, setAccountNumber] = React.useState(card?.number.replace(/\D/g, '').slice(-4) ?? '');
  const [balanceText, setBalanceText] = React.useState(
    card ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(card.balance) : '',
  );
  const [type, setType] = React.useState<CardDraft['type']>(
    card?.type.toLowerCase() === 'credit' ? 'credit' : 'debit',
  );
  const [network, setNetwork] = React.useState<CardNetwork>(
    card?.network === 'Mastercard' || card?.network === 'RuPay' ? card.network : 'VISA',
  );
  const [paletteName, setPaletteName] = React.useState(initialPalette.name);
  const [colors, setColors] = React.useState<readonly [string, string, string]>(initialPalette.colors);
  const [touched, setTouched] = React.useState<Partial<Record<keyof CardDraft, boolean>>>({});
  const [attempted, setAttempted] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const entrance = useSharedValue(0);
  const previewOpacity = useSharedValue(1);
  const bankRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const holderRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const accountNumberRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const balanceRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);
  const bankCardCount = cards.filter((existing) => existing.id !== 'cash-wallet').length;
  const allowAdd = Boolean(card) || bankCardCount < 10;
  const normalizedBalance = balanceText.replace(/,/g, '');
  const draft: CardDraft = {
    bank,
    holder,
    accountNumber,
    type,
    balance: normalizedBalance.trim() ? Number(normalizedBalance) : Number.NaN,
    network,
  };
  const errors = validateCardDraft(draft);
  const visibleError = (field: keyof CardDraft) =>
    (attempted || touched[field]) ? errors[field] : undefined;
  const valid = Object.keys(errors).length === 0;
  const hasChanges = cashWallet
    ? bank.trim() !== (card?.bank ?? '') || colors[0] !== initialPalette.colors[0]
    : Boolean(
    bank.trim() !== (card?.bank ?? '') ||
    holder.trim() !== (card?.holder ?? '') ||
    accountNumber !== (card?.number.replace(/\D/g, '').slice(-4) ?? '') ||
    normalizedBalance !== (card ? String(card.balance) : '') ||
    type !== (card?.type.toLowerCase() === 'credit' ? 'credit' : 'debit') ||
    network !== (card?.network === 'Mastercard' || card?.network === 'RuPay' ? card.network : 'VISA') ||
    colors[0] !== initialPalette.colors[0],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{
      translateY: reducedMotion ? 0 : (1 - entrance.value) * height * 0.18,
    }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: entrance.value * 0.45 }));
  const previewStyle = useAnimatedStyle(() => ({ opacity: previewOpacity.value }));

  React.useEffect(() => {
    if (!visible) return;
    setClosing(false);
    entrance.value = 0;
    entrance.value = withTiming(1, {
      duration: reducedMotion ? 120 : 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [entrance, reducedMotion, visible]);

  React.useEffect(() => {
    previewOpacity.value = withSequence(
      withTiming(0.35, { duration: reducedMotion ? 0 : 90 }),
      withTiming(1, { duration: reducedMotion ? 100 : 110 }),
    );
  }, [colors, previewOpacity, reducedMotion]);

  const finishClose = React.useCallback(() => {
    if (closing) return;
    const close = () => {
      setClosing(true);
      entrance.value = withTiming(0, { duration: reducedMotion ? 80 : 180 }, (finished) => {
        if (finished) runOnJS(onClose)();
      });
    };
    if (hasChanges) {
      Alert.alert('Discard changes?', 'Your card details have not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: close },
      ]);
      return;
    }
    close();
  }, [closing, entrance, hasChanges, onClose, reducedMotion]);
  const sheetPanResponder = React.useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 8,
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy > 90) finishClose();
      },
    }),
    [finishClose],
  );

  const setFieldTouched = (field: keyof CardDraft) =>
    setTouched((current) => ({ ...current, [field]: true }));

  const previewCard: WalletCard = {
    id: card?.id ?? 'new-card-preview',
    bank: bank.trim() || 'BANK NAME',
    displayName: bank.trim() || 'BANK NAME',
    holder: holder.trim().toUpperCase() || 'CARD HOLDER',
    type: type.toUpperCase(),
    category: type,
    number: accountNumber ? `•••• ${accountNumber.slice(-4)}` : '•••• 0000',
    network,
    expiry: card?.expiry ?? '08 / 32',
    currency: card?.currency ?? 'INR',
    colors,
    balance: Number.isFinite(draft.balance) ? draft.balance : 0,
    monthlySpend: card?.monthlySpend ?? 0,
    transactions: card?.transactions ?? [],
    ...(card?.creditLimit ? { creditLimit: card.creditLimit } : {}),
    ...(card?.outstanding ? { outstanding: card.outstanding } : {}),
  };

  const save = () => {
    setAttempted(true);
    if (cashWallet) {
      if (!bank.trim()) return;
      onSave({ ...draft, bank: bank.trim(), holder: card?.holder ?? '' }, colors, card, () => {
        entrance.value = withTiming(0, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      });
      return;
    }
    if (!valid || !allowAdd) return;
    const duplicate = hasDuplicateCard(cards, draft, card?.id);
    const submit = () => onSave(
      { ...draft, bank: bank.trim(), holder: holder.trim().toUpperCase() },
      colors,
      card,
      () => {
        entrance.value = withTiming(0, { duration: reducedMotion ? 80 : 180 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      },
    );
    if (duplicate) {
      Alert.alert('This account already exists', 'An account with this bank name and number already exists.', [
        { text: 'Cancel', style: 'cancel' },
        { text: card ? 'Save anyway' : 'Add anyway', onPress: submit },
      ]);
      return;
    }
    submit();
  };

  const usedColors = cards
    .filter((existing) => existing.id !== card?.id)
    .map((existing) => existing.colors[0]);
  const errorsVisible = (field: keyof CardDraft) => {
    const message = visibleError(field);
    return message ? (
      <Text accessibilityLiveRegion="polite" style={styles.error}>{message}</Text>
    ) : null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={finishClose}
    >
      <GestureHandlerRootView style={styles.modalRoot}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
        <Pressable accessibilityLabel="Close card form" style={StyleSheet.absoluteFill} onPress={finishClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardRoot}
        >
          <Animated.View
            style={[
              styles.sheet,
              { height: height * 0.9, paddingBottom: Math.max(insets.bottom, 14) },
              sheetStyle,
            ]}
          >
            <View {...sheetPanResponder.panHandlers} style={styles.dragArea}>
              <View style={styles.handle} />
            </View>
            <View style={styles.heading}>
              <Text style={styles.title}>
                {cashWallet ? 'Edit wallet' : card ? 'Edit card' : 'Add new card'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={finishClose}
                hitSlop={8}
                style={styles.closeButton}
              >
                <Feather name="x" size={20} color="#303039" />
              </Pressable>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={[styles.preview, previewStyle]}>
                {renderPreview(previewCard)}
              </Animated.View>

              <Text style={styles.label}>{cashWallet ? 'WALLET NAME' : 'BANK'}</Text>
              <TextInput
                ref={bankRef}
                accessibilityLabel={cashWallet ? 'Wallet name' : 'Bank'}
                value={bank}
                onChangeText={(value) => setBank(value.slice(0, 30))}
                onBlur={() => setFieldTouched('bank')}
                placeholder={cashWallet ? 'Wallet name' : 'e.g. HDFC Bank'}
                placeholderTextColor="#A0A0A5"
                maxLength={30}
                returnKeyType={cashWallet ? 'done' : 'next'}
                onSubmitEditing={() => holderRef.current?.focus()}
                style={styles.input}
              />
              {!cashWallet ? (
                <>
                  {errorsVisible('bank')}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestions}>
                    {SUGGESTIONS.map((suggestion) => (
                      <Pressable
                        key={suggestion}
                        onPress={() => setBank(suggestion)}
                        style={styles.suggestion}
                      >
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>CARD HOLDER NAME</Text>
                  <TextInput
                    ref={holderRef}
                    accessibilityLabel="Card holder name"
                    value={holder}
                    onChangeText={(value) => setHolder(value.replace(/[^a-zA-Z ]/g, '').slice(0, 26).toUpperCase())}
                    onBlur={() => setFieldTouched('holder')}
                    placeholder="e.g. YOUR NAME"
                    placeholderTextColor="#A0A0A5"
                    autoCapitalize="characters"
                    maxLength={26}
                    returnKeyType="next"
                    onSubmitEditing={() => accountNumberRef.current?.focus()}
                    style={styles.input}
                  />
                  {errorsVisible('holder')}

                  <Text style={styles.label}>
                    {type === 'debit' ? 'LAST 4 ACCOUNT DIGITS' : 'LAST 4 CARD DIGITS'}
                  </Text>
                  <TextInput
                    ref={accountNumberRef}
                    accessibilityLabel={type === 'debit' ? 'Bank account number' : 'Last four card digits'}
                    value={accountNumber}
                    onChangeText={(value) => {
                      const digits = value.replace(/\D/g, '');
                      setAccountNumber(digits.slice(0, 4));
                    }}
                    onBlur={() => setFieldTouched('accountNumber')}
                    placeholder="1234"
                    placeholderTextColor="#A0A0A5"
                    keyboardType="number-pad"
                    maxLength={4}
                    returnKeyType="next"
                    onSubmitEditing={() => balanceRef.current?.focus()}
                    style={styles.input}
                  />
                  <Text style={styles.helper}>
                    {type === 'debit'
                      ? 'Enter only the last 4 digits of your bank account.'
                      : 'Enter only the last 4 digits. Never enter your full card number, expiry or CVV.'}
                  </Text>
                  {errorsVisible('accountNumber')}

                  <Text style={styles.label}>BANK BALANCE</Text>
                  <View style={styles.balanceInput}>
                    <Text style={styles.currency}>{currencySymbol(card?.currency ?? 'INR')}</Text>
                    <TextInput
                      ref={balanceRef}
                      accessibilityLabel="Bank balance"
                      value={balanceText}
                      onChangeText={(value) => setBalanceText(formatBalanceInput(value))}
                      onBlur={() => setFieldTouched('balance')}
                      placeholder="0.00"
                      placeholderTextColor="#A0A0A5"
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                      style={styles.balanceTextInput}
                    />
                  </View>
                  {errorsVisible('balance')}

                  <Text style={styles.label}>CARD NETWORK</Text>
                  <NetworkPicker value={network} onChange={setNetwork} />
                </>
              ) : null}

              <Text style={styles.label}>CARD COLOR</Text>
              <ColorPalette
                value={paletteName}
                colors={colors}
                usedColors={usedColors}
                reducedMotion={reducedMotion}
                onChange={(name, nextColors) => {
                  setPaletteName(name);
                  setColors(nextColors);
                }}
              />
            </ScrollView>
            {!allowAdd ? (
              <Text style={styles.limitMessage}>You can add up to 10 cards.</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !valid || (!allowAdd && !card) }}
              disabled={cashWallet ? !bank.trim() : !valid || !allowAdd}
              onPress={save}
              style={[
                styles.saveButton,
                (cashWallet ? !bank.trim() : !valid || !allowAdd) && styles.saveButtonDisabled,
              ]}
            >
              <Text style={styles.saveButtonText}>
                {cashWallet ? 'Save changes' : card ? 'Save changes' : 'Add card'}
              </Text>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
  },
  keyboardRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: '#FFFDFC',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D5D5DA',
  },
  dragArea: {
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: '#202027',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F1F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 14,
  },
  preview: {
    marginBottom: 14,
  },
  label: {
    color: '#686870',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 15,
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E1E5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    color: '#26262D',
    fontSize: 15,
  },
  error: {
    color: '#C92A35',
    fontSize: 11,
    marginTop: 4,
  },
  suggestions: {
    gap: 7,
    paddingTop: 9,
  },
  suggestion: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#F0F0F2',
  },
  suggestionText: {
    color: '#45454C',
    fontSize: 11,
    fontWeight: '600',
  },
  helper: {
    color: '#85858D',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  balanceInput: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E1E5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
  },
  currency: {
    color: '#55555D',
    fontSize: 16,
    marginRight: 7,
  },
  balanceTextInput: {
    flex: 1,
    color: '#26262D',
    fontSize: 15,
  },
  limitMessage: {
    color: '#B63211',
    fontSize: 12,
    marginBottom: 8,
  },
  saveButton: {
    height: 52,
    borderRadius: 15,
    backgroundColor: '#E8420F',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveButtonDisabled: {
    opacity: 0.42,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default React.memo(AddCardSheet);
