import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';

import { Transaction } from '../data/transactions';
import { formatWalletCurrency } from '../context/WalletCardsContext';
import { getTransactionMode } from '../utils/transactionCategories';

type TransactionItemProps = {
  item: Transaction;
  newlyAdded?: boolean;
};

const CATEGORY_FEATHER: Record<string, keyof typeof Feather.glyphMap> = {
  'Food and dining': 'coffee',
  Groceries: 'shopping-bag',
  Transport: 'navigation',
  Fuel: 'truck',
  Shopping: 'shopping-bag',
  'Bills and utilities': 'file-text',
  Rent: 'home',
  Entertainment: 'play',
  Health: 'heart',
  Education: 'book',
  Travel: 'map',
  Subscriptions: 'repeat',
  Transfers: 'repeat',
  Salary: 'briefcase',
  Freelance: 'monitor',
  Business: 'briefcase',
  Investments: 'trending-up',
  Refund: 'corner-down-left',
  Gift: 'gift',
  Interest: 'dollar-sign',
};

function TransactionItem({ item, newlyAdded = false }: TransactionItemProps) {
  const entrance = React.useRef(new Animated.Value(newlyAdded ? 0 : 1)).current;
  React.useEffect(() => {
    if (!newlyAdded) return;
    entrance.setValue(0);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [entrance, newlyAdded]);

  const mode = getTransactionMode(item);
  const amountText = `${mode === 'expense' ? '−' : ''}${formatWalletCurrency(item.amount, 'INR')}`;
  const categoryIcon = item.category ? CATEGORY_FEATHER[item.category] : undefined;

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.iconWrap}>
        {categoryIcon ? (
          <Feather name={categoryIcon} size={19} color="#6D6D73" />
        ) : item.type === 'adobe' ? (
          <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityLabel="Adobe Creative Cloud">
            <Circle cx="12" cy="12" r="8.5" fill="none" stroke="#E1251B" strokeWidth="3.5" />
            <Path d="M8.2 15.4 12 8.6l3.8 6.8" fill="none" stroke="#E1251B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : item.type === 'stripe' ? (
          <Text style={styles.stripeMark}>stripe</Text>
        ) : item.type === 'briefcase' ? (
          <Feather name="briefcase" size={18} color="#6D6D73" style={styles.briefcaseIcon} />
        ) : (
          <Text style={styles.otherMark}>◌</Text>
        )}
      </View>

      <View style={styles.metaWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>

      <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>{amountText}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 20,
    minHeight: 68,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EDEDED',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stripeMark: {
    color: '#4E4D54',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  briefcaseIcon: {
    opacity: 0.9,
  },
  otherMark: {
    color: '#111111',
    fontSize: 12,
    fontWeight: '700',
  },
  metaWrap: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
    color: '#1B1B1F',
    letterSpacing: -0.3,
    maxWidth: '100%',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: '#8B8B90',
    letterSpacing: -0.2,
  },
  amount: {
    fontSize: 15,
    fontWeight: '500',
    width: 110,
    textAlign: 'right',
    letterSpacing: -0.3,
    color: '#111111',
  },
});

export default React.memo(TransactionItem);
