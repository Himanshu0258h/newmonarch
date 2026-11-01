import React from 'react';
import HomeScreen from './screens/HomeScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WalletCardsProvider } from './context/WalletCardsContext';

export default function App() {
  return (
    <SafeAreaProvider>
      <WalletCardsProvider>
        <HomeScreen />
      </WalletCardsProvider>
    </SafeAreaProvider>
  );
}
