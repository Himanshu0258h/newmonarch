import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getWalletCardDisplayName, type WalletCard } from '../../data/walletCards';
import { formatWalletCurrency } from '../../context/WalletCardsContext';

type Props = {
  visible: boolean;
  cards: readonly WalletCard[];
  masked: boolean;
  onClose: () => void;
  onAddCard: () => void;
  onEdit: (card: WalletCard) => void;
  onSetDefault: (card: WalletCard) => void;
  onDelete: (card: WalletCard) => void;
  onMove: (card: WalletCard, targetIndex: number) => void;
};

const CARD_ROW_HEIGHT = 76;
const CARD_ROW_GAP = 8;
const CARD_ROW_STEP = CARD_ROW_HEIGHT + CARD_ROW_GAP;

type ActiveDrag = {
  cardId: string;
  startIndex: number;
  targetIndex: number;
};

function isCashWallet(card: WalletCard) {
  return card.id === 'cash-wallet';
}

function ManageCardRow({
  card,
  index,
  itemCount,
  isDefault,
  masked,
  onSetDefault,
  activeDrag,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  scrollGesture,
  onOpenActions,
}: {
  card: WalletCard;
  index: number;
  itemCount: number;
  isDefault: boolean;
  masked: boolean;
  onSetDefault: (card: WalletCard) => void;
  activeDrag: ActiveDrag | null;
  onDragStart: (cardId: string, index: number) => void;
  onDragMove: (cardId: string, index: number, targetIndex: number) => void;
  onDragEnd: (cardId: string, index: number, targetIndex: number) => void;
  onDragCancel: () => void;
  scrollGesture: ReturnType<typeof Gesture.Native>;
  onOpenActions: (card: WalletCard) => void;
}) {
  const translateY = useSharedValue(0);
  const targetIndexValue = useSharedValue(index);
  const didDrop = useSharedValue(false);
  const dragTargetIndex = activeDrag?.targetIndex ?? index;
  const shift = activeDrag && activeDrag.cardId !== card.id
    ? activeDrag.startIndex < dragTargetIndex &&
      index > activeDrag.startIndex &&
      index <= dragTargetIndex
      ? -CARD_ROW_STEP
      : activeDrag.startIndex > dragTargetIndex &&
          index >= dragTargetIndex &&
          index < activeDrag.startIndex
        ? CARD_ROW_STEP
        : 0
    : 0;
  const isDragging = activeDrag?.cardId === card.id;
  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: isDragging
        ? translateY.value
        : withSpring(shift, { damping: 22, stiffness: 220 }),
    }],
  }), [isDragging, shift]);
  const dragGesture = React.useMemo(
    () => Gesture.Pan()
      .activateAfterLongPress(250)
      .shouldCancelWhenOutside(false)
      .blocksExternalGesture(scrollGesture)
      .onStart(() => {
        didDrop.value = false;
        targetIndexValue.value = index;
        runOnJS(onDragStart)(card.id, index);
      })
      .onUpdate((event) => {
        translateY.value = event.translationY;
        const targetIndex = Math.max(
          0,
          Math.min(itemCount - 1, index + Math.round(event.translationY / CARD_ROW_STEP)),
        );
        if (targetIndex !== targetIndexValue.value) {
          targetIndexValue.value = targetIndex;
          runOnJS(onDragMove)(card.id, index, targetIndex);
        }
      })
      .onEnd(() => {
        didDrop.value = true;
        translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
        runOnJS(onDragEnd)(card.id, index, targetIndexValue.value);
      })
      .onFinalize(() => {
        if (!didDrop.value) {
          translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
          runOnJS(onDragCancel)();
        }
      }),
    [
      card,
      didDrop,
      index,
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
  const cash = isCashWallet(card);

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View
        style={[
          styles.cardRow,
          isDefault && styles.defaultCardRow,
          activeDrag?.cardId === card.id && styles.draggingCardRow,
          rowAnimatedStyle,
        ]}
      >
        <View style={styles.thumbnail}>
          <LinearGradient
            colors={card.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Feather name="credit-card" size={18} color="rgba(255,255,255,0.9)" />
        </View>
        <View style={styles.cardDetails}>
          <View style={styles.nameLine}>
            <Text numberOfLines={1} style={styles.bankName}>
              {getWalletCardDisplayName(card)}
            </Text>
            {isDefault ? <Text style={styles.defaultBadge}>Default</Text> : null}
          </View>
          <Text style={styles.cardMeta}>
            {cash ? 'Cash account' : `•••• ${card.number.replace(/\D/g, '').slice(-4)} · ${card.type}`}
          </Text>
          <Text numberOfLines={1} style={styles.balance}>
            {masked ? '••••••' : formatWalletCurrency(card.balance, card.currency ?? 'INR')}
          </Text>
        </View>
        <View style={styles.rowActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isDefault
              ? `${getWalletCardDisplayName(card)} is the default card`
              : `Set ${getWalletCardDisplayName(card)} as default`}
            accessibilityState={{ selected: isDefault }}
            disabled={isDefault}
            onPress={() => onSetDefault(card)}
            style={styles.starButton}
          >
            <Ionicons
              name={isDefault ? 'star' : 'star-outline'}
              size={19}
              color={isDefault ? '#E5A52E' : '#797982'}
            />
          </Pressable>
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Briefly hold anywhere on this card, then drag to move ${getWalletCardDisplayName(card)}`}
            style={styles.dragHandle}
          >
            <Feather name="menu" size={19} color="#797982" />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Actions for ${getWalletCardDisplayName(card)}`}
            onPress={() => onOpenActions(card)}
            style={styles.moreButton}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#33333A" />
          </Pressable>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

function ManageCardsSheet({
  visible,
  cards,
  masked,
  onClose,
  onAddCard,
  onEdit,
  onSetDefault,
  onDelete,
  onMove,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const scrollGesture = React.useMemo(() => Gesture.Native(), []);
  const [actionCard, setActionCard] = React.useState<WalletCard | null>(null);
  const [activeDrag, setActiveDrag] = React.useState<ActiveDrag | null>(null);
  const activeDragRef = React.useRef<ActiveDrag | null>(null);
  const cardsRef = React.useRef(cards);
  const onMoveRef = React.useRef(onMove);
  cardsRef.current = cards;
  onMoveRef.current = onMove;
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - progress.value) * height * 0.14 }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.45 }));
  const defaultId = cards.find((card) => card.isDefault)?.id ?? cards[0]?.id;

  React.useEffect(() => {
    if (!visible) return;
    setActionCard(null);
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: reducedMotion ? 100 : 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reducedMotion, visible]);

  const close = React.useCallback(() => {
    progress.value = withTiming(0, { duration: reducedMotion ? 80 : 160 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [onClose, progress, reducedMotion]);

  const startDrag = React.useCallback((cardId: string, startIndex: number) => {
    const drag = { cardId, startIndex, targetIndex: startIndex };
    activeDragRef.current = drag;
    setActiveDrag(drag);
  }, []);

  const moveDrag = React.useCallback((cardId: string, startIndex: number, targetIndex: number) => {
    if (activeDragRef.current?.targetIndex === targetIndex) return;
    const drag = { cardId, startIndex, targetIndex };
    activeDragRef.current = drag;
    setActiveDrag(drag);
  }, []);

  const endDrag = React.useCallback((cardId: string, startIndex: number, targetIndex: number) => {
    if (targetIndex !== startIndex) {
      const card = cardsRef.current.find((item) => item.id === cardId);
      if (card) onMoveRef.current(card, targetIndex);
    }
    activeDragRef.current = null;
    setActiveDrag(null);
  }, []);

  const cancelDrag = React.useCallback(() => {
    activeDragRef.current = null;
    setActiveDrag(null);
  }, []);

  const bankCards = cards.filter((card) => !isCashWallet(card));
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, backdropStyle]} />
        <Pressable accessibilityLabel="Close manage cards" style={StyleSheet.absoluteFill} onPress={close} />
        <Animated.View
          style={[
            styles.sheet,
            { height: height * 0.82, paddingBottom: Math.max(insets.bottom, 14) },
            sheetStyle,
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.heading}>
            <View>
              <Text style={styles.title}>Manage cards</Text>
              <Text style={styles.subtitle}>
                {cards.length} accounts · Tap star to set default · Hold a card to reorder
              </Text>
            </View>
            <Pressable accessibilityRole="button" onPress={close} style={styles.closeButton}>
              <Feather name="x" size={20} color="#303039" />
            </Pressable>
          </View>
          <GestureDetector gesture={scrollGesture}>
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {cards.map((card, index) => (
                <ManageCardRow
                  key={card.id}
                  card={card}
                  index={index}
                  itemCount={cards.length}
                  isDefault={card.id === defaultId}
                  masked={masked}
                  onSetDefault={onSetDefault}
                  activeDrag={activeDrag}
                  onDragStart={startDrag}
                  onDragMove={moveDrag}
                  onDragEnd={endDrag}
                  onDragCancel={cancelDrag}
                  scrollGesture={scrollGesture}
                  onOpenActions={(selectedCard) =>
                    setActionCard((current) => current?.id === selectedCard.id ? null : selectedCard)
                  }
                />
              ))}
              {bankCards.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="card-outline" size={32} color="#9A9AA2" />
                  <Text style={styles.emptyTitle}>No cards yet</Text>
                  <Pressable accessibilityRole="button" onPress={onAddCard} style={styles.emptyAdd}>
                    <Text style={styles.emptyAddText}>Add new card</Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </GestureDetector>

          {actionCard ? (
            <View style={styles.actionPanel}>
              <Text numberOfLines={1} style={styles.actionTitle}>
                {getWalletCardDisplayName(actionCard)}
              </Text>
              <Pressable style={styles.actionRow} onPress={() => onEdit(actionCard)}>
                <Feather name="edit-2" size={17} color="#33333A" />
                <Text style={styles.actionText}>Edit</Text>
              </Pressable>
              {!isCashWallet(actionCard) ? (
                <Pressable style={styles.actionRow} onPress={() => onDelete(actionCard)}>
                  <Feather name="trash-2" size={17} color="#D93636" />
                  <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.cancelAction} onPress={() => setActionCard(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
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
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: '#D5D5DA',
    marginBottom: 12,
  },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#202027',
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: '#85858D',
    fontSize: 12,
    marginTop: 3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F1F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: CARD_ROW_GAP,
    paddingBottom: 20,
  },
  cardRow: {
    height: CARD_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 9,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEF0',
  },
  defaultCardRow: {
    borderColor: '#F3D4B8',
    backgroundColor: '#FFFCF9',
  },
  draggingCardRow: {
    zIndex: 2,
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  thumbnail: {
    width: 56,
    height: 36,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDetails: {
    flex: 1,
    minWidth: 0,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bankName: {
    flexShrink: 1,
    color: '#2A2A31',
    fontSize: 13,
    fontWeight: '600',
  },
  defaultBadge: {
    color: '#A8431D',
    backgroundColor: '#FFF0E8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
    fontSize: 9,
    fontWeight: '700',
  },
  cardMeta: {
    color: '#85858D',
    fontSize: 10,
    marginTop: 3,
  },
  balance: {
    color: '#292930',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  starButton: {
    width: 34,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 32,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButton: {
    width: 32,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 42,
    gap: 10,
  },
  emptyTitle: {
    color: '#696970',
    fontSize: 15,
  },
  emptyAdd: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#E8420F',
  },
  emptyAddText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  actionPanel: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E7EA',
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 9,
  },
  actionTitle: {
    color: '#85858D',
    fontSize: 11,
    marginBottom: 6,
  },
  actionRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    color: '#33333A',
    fontSize: 14,
  },
  deleteText: {
    color: '#D93636',
  },
  cancelAction: {
    alignItems: 'center',
    marginTop: 5,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8E8EB',
  },
  cancelText: {
    color: '#8C8C94',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default React.memo(ManageCardsSheet);
