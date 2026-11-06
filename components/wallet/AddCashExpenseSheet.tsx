import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const cashExpenseCategories = [
  { label: 'Food', icon: 'cafe' as const },
  { label: 'Transport', icon: 'car' as const },
  { label: 'Groceries', icon: 'basket' as const },
  { label: 'Shopping', icon: 'bag' as const },
  { label: 'Other', icon: 'color-palette' as const },
];

type Props = {
  visible: boolean;
  accountName: string;
  onClose: () => void;
  onSave: (expense: { amount: number; category: string; note: string; date: Date }) => void;
};

function localDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function AddCashExpenseSheet({ visible, accountName, onClose, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = React.useState('');
  const [category, setCategory] = React.useState('Food');
  const [note, setNote] = React.useState('');
  const [date, setDate] = React.useState(localDateInput(new Date()));
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!visible) return;
    setAmount('');
    setCategory('Food');
    setNote('');
    setDate(localDateInput(new Date()));
    setError('');
  }, [visible]);

  const save = () => {
    const parsedAmount = Number(amount);
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T12:00:00`)
      : new Date(Number.NaN);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (Number.isNaN(parsedDate.getTime()) || localDateInput(parsedDate) !== date) {
      setError('Enter a valid date in YYYY-MM-DD format.');
      return;
    }
    onSave({ amount: parsedAmount, category, note: note.trim(), date: parsedDate });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close add expense"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
        >
          {/*
            Previous popup header retained as a commented reference:
            <View style={styles.heading}>
              <Text style={styles.eyebrow}>{accountName.toUpperCase()}</Text>
              <Text style={styles.title}>Add expense</Text>
            </View>
          */}
          <LinearGradient
            colors={['#662118', '#B83C25', '#F05A3A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.dragHandle} />
            <View style={styles.heading}>
              <View style={styles.titleBlock}>
                <View style={styles.eyebrowRow}>
                  <View style={styles.heroIcon}>
                    <Feather name="arrow-up-right" size={15} color="#FFFFFF" />
                  </View>
                  <Text style={styles.eyebrow}>{accountName.toUpperCase()} · MONEY OUT</Text>
                </View>
                <Text style={styles.title}>Add expense</Text>
                <Text style={styles.subtitle}>Capture the little things that add up.</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
                <Feather name="x" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </LinearGradient>

          <Text style={styles.label}>HOW MUCH?</Text>
          <View style={styles.amountInputWrap}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              accessibilityLabel="Expense amount"
              value={amount}
              onChangeText={(value) => {
                setAmount(value.replace(/[^\d.]/g, ''));
                setError('');
              }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#A0A0A5"
              style={styles.amountInput}
            />
          </View>

          <Text style={styles.label}>CATEGORY</Text>
          <View style={styles.categories}>
            {cashExpenseCategories.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityState={{ selected: category === item.label }}
                onPress={() => setCategory(item.label)}
                style={[styles.categoryChip, category === item.label && styles.categoryChipActive]}
              >
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={category === item.label ? '#C63A25' : '#797D87'}
                />
                <Text
                  style={[
                    styles.categoryText,
                    category === item.label && styles.categoryTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>NOTE</Text>
          <TextInput
            accessibilityLabel="Expense note"
            value={note}
            onChangeText={setNote}
            placeholder="What was this expense for?"
            placeholderTextColor="#A0A0A5"
            style={styles.input}
          />

          <Text style={styles.label}>DATE</Text>
          <TextInput
            accessibilityLabel="Expense date"
            value={date}
            onChangeText={(value) => {
              setDate(value);
              setError('');
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#A0A0A5"
            maxLength={10}
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" onPress={save} style={styles.saveButton}>
            <LinearGradient
              colors={['#8E2D20', '#F05A3A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGradient}
            >
              <Text style={styles.saveText}>Save expense</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(9,17,30,0.52)',
  },
  sheet: {
    paddingTop: 0,
    paddingHorizontal: 22,
    backgroundColor: '#F7F7F8',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  hero: {
    marginHorizontal: -22,
    paddingTop: 8,
    paddingHorizontal: 22,
    paddingBottom: 20,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.42)',
    marginBottom: 14,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
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
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.7,
    marginTop: 5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 12,
    marginTop: 3,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#737782',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.25,
    marginTop: 17,
    marginBottom: 9,
  },
  amountInputWrap: {
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E7E8EC',
    backgroundColor: '#FFFFFF',
    shadowColor: '#182033',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  rupee: {
    color: '#E65335',
    fontSize: 33,
    fontWeight: '500',
    marginRight: 9,
  },
  amountInput: {
    flex: 1,
    color: '#202735',
    fontSize: 32,
    fontWeight: '700',
    padding: 0,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E7E8EC',
    backgroundColor: '#FFFFFF',
  },
  categoryChipActive: {
    borderColor: '#F0B7A9',
    backgroundColor: '#FFF0EC',
  },
  categoryText: {
    color: '#656B76',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#C63A25',
  },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7E8EC',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    color: '#202735',
    fontSize: 14,
  },
  error: {
    color: '#B42318',
    fontSize: 12,
    marginTop: 12,
  },
  saveButton: {
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    overflow: 'hidden',
    marginTop: 24,
    marginBottom: 8,
    shadowColor: '#A63725',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  saveGradient: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AddCashExpenseSheet;
