import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type CardNetwork = 'VISA' | 'Mastercard' | 'RuPay';

type Props = {
  value: CardNetwork;
  onChange: (network: CardNetwork) => void;
};

const NETWORKS: CardNetwork[] = ['VISA', 'Mastercard', 'RuPay'];

export default function NetworkPicker({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {NETWORKS.map((network) => (
        <Pressable
          key={network}
          accessibilityRole="button"
          accessibilityState={{ selected: value === network }}
          accessibilityLabel={`${network} card network`}
          onPress={() => onChange(network)}
          style={[styles.tile, value === network && styles.tileSelected]}
        >
          {network === 'Mastercard' ? (
            <View style={styles.mastercardMark}>
              <View style={[styles.mastercardCircle, styles.mastercardRed]} />
              <View style={[styles.mastercardCircle, styles.mastercardGold]} />
            </View>
          ) : (
            <Text style={[styles.wordmark, styles.italic]}>
              {network}
            </Text>
          )}
          {value === network ? (
            <Ionicons name="checkmark-circle" size={16} color="#E8420F" style={styles.check} />
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
  },
  tileSelected: {
    borderColor: '#E8420F',
    borderWidth: 2,
  },
  wordmark: {
    color: '#28313D',
    fontSize: 15,
    fontWeight: '700',
  },
  italic: {
    fontSize: 18,
    fontStyle: 'italic',
  },
  mastercardMark: {
    width: 36,
    height: 23,
    flexDirection: 'row',
    alignItems: 'center',
  },
  mastercardCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  mastercardRed: {
    backgroundColor: '#EB4548',
  },
  mastercardGold: {
    backgroundColor: 'rgba(255,179,62,0.92)',
    marginLeft: -6,
  },
  check: {
    position: 'absolute',
    right: 4,
    top: 4,
  },
});
