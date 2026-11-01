import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';

import { Transaction } from '../data/transactions';
import theme from '../theme';

type TransactionItemProps = {
  item: Transaction;
};

export default function TransactionItem({ item }: TransactionItemProps) {
  const sign = item.isPositive ? '' : '-';
  const fractionDigits = item.type === 'stripe' ? 0 : 2;
  const amountText = `${sign}$${item.amount.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;

  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        {item.type === 'adobe' && (
          <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityLabel="Adobe Creative Cloud">
            <Circle cx="12" cy="12" r="8.5" fill="none" stroke="#E1251B" strokeWidth="3.5" />
            <Path d="M8.2 15.4 12 8.6l3.8 6.8" fill="none" stroke="#E1251B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
        {item.type === 'stripe' && <Text style={styles.stripeMark}>stripe</Text>}
        {item.type === 'briefcase' && (
          <Feather name="briefcase" size={18} color="#6D6D73" style={styles.briefcaseIcon} />
        )}
        {item.type === 'other' && <Text style={styles.otherMark}>◌</Text>}
      </View>

      <View style={styles.metaWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>

      <Text style={styles.amount}>{amountText}</Text>
    </View>
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
    width: 94,
    textAlign: 'right',
    letterSpacing: -0.3,
    color: '#111111',
  },
});
