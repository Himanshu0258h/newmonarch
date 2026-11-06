import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export type CardPalette = {
  name: string;
  colors: readonly [string, string, string];
};

export const CARD_PALETTES: CardPalette[] = [
  { name: 'Emerald', colors: ['#2F6F5A', '#245343', '#173B33'] },
  { name: 'Ocean', colors: ['#1F5F8B', '#17466C', '#0E2A47'] },
  { name: 'Violet', colors: ['#7B3FA0', '#5D3185', '#3E2169'] },
  { name: 'Crimson', colors: ['#B3263B', '#851B30', '#5A1020'] },
  { name: 'Amber', colors: ['#D98A2B', '#A9641D', '#7A4310'] },
  { name: 'Graphite', colors: ['#3A3F4A', '#262A33', '#14161C'] },
  { name: 'Rose', colors: ['#D6567F', '#A83B62', '#7A2145'] },
  { name: 'Teal', colors: ['#1B8A8F', '#145E6D', '#0B3F4A'] },
  { name: 'Midnight', colors: ['#1E2A78', '#151D5C', '#0B1040'] },
  { name: 'Sunset', colors: ['#F2703A', '#C34A27', '#8E2A16'] },
  { name: 'Gold', colors: ['#C9A24A', '#987A31', '#6B5217'] },
  { name: 'Silver', colors: ['#8A94A6', '#626D82', '#3E4656'] },
];

const CUSTOM_COLORS = [
  { name: 'Red', hue: 0 },
  { name: 'Coral', hue: 15 },
  { name: 'Orange', hue: 30 },
  { name: 'Amber', hue: 45 },
  { name: 'Yellow', hue: 60 },
  { name: 'Lime', hue: 90 },
  { name: 'Green', hue: 120 },
  { name: 'Mint', hue: 150 },
  { name: 'Teal', hue: 180 },
  { name: 'Cyan', hue: 200 },
  { name: 'Blue', hue: 225 },
  { name: 'Indigo', hue: 250 },
  { name: 'Violet', hue: 275 },
  { name: 'Purple', hue: 295 },
  { name: 'Magenta', hue: 320 },
  { name: 'Rose', hue: 340 },
] as const;

type Props = {
  value: string;
  colors: readonly [string, string, ...string[]];
  usedColors: readonly string[];
  reducedMotion: boolean;
  onChange: (name: string, colors: readonly [string, string, string]) => void;
};

function hslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1 ? [chroma, x, 0] :
      section < 2 ? [x, chroma, 0] :
        section < 3 ? [0, chroma, x] :
          section < 4 ? [0, x, chroma] :
            section < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const match = lightness - chroma / 2;
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function hexToHue(hex: string) {
  const normalized = hex.replace('#', '');
  if (!/^[\da-f]{6}$/i.test(normalized)) return 24;
  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const difference = maximum - minimum;
  if (difference === 0) return 24;
  const hue =
    maximum === red
      ? 60 * (((green - blue) / difference) % 6)
      : maximum === green
        ? 60 * ((blue - red) / difference + 2)
        : 60 * ((red - green) / difference + 4);
  return (hue + 360) % 360;
}

export default function ColorPalette({
  colors,
  onChange,
}: Props) {
  const [hue, setHue] = React.useState(() => hexToHue(colors[0]));
  const applyHue = React.useCallback((nextHue: number) => {
    setHue(nextHue);
    onChange('Custom', [
      hslToHex(nextHue, 0.55, 0.38),
      hslToHex(nextHue, 0.575, 0.28),
      hslToHex(nextHue, 0.6, 0.18),
    ]);
  }, [onChange]);
  const selectedCustomHue = CUSTOM_COLORS.reduce(
    (closest, color) => {
      const currentDistance = Math.abs(((hue - closest.hue + 540) % 360) - 180);
      const nextDistance = Math.abs(((hue - color.hue + 540) % 360) - 180);
      return nextDistance < currentDistance ? color : closest;
    },
    CUSTOM_COLORS[0],
  );

  return (
    <View>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Card color palette"
        style={styles.customPalette}
      >
        {CUSTOM_COLORS.map((color) => {
          const selected = selectedCustomHue.name === color.name;
          const swatchColor = hslToHex(color.hue, 0.72, 0.48);
          return (
            <Pressable
              key={color.name}
              accessibilityRole="button"
              accessibilityLabel={`${color.name} card color`}
              accessibilityState={{ selected }}
              onPress={() => applyHue(color.hue)}
              style={[styles.customColorTarget, selected && styles.customColorSelected]}
            >
              <View style={[styles.customColorSwatch, { backgroundColor: swatchColor }]}>
                {selected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  customPalette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
    marginTop: 12,
  },
  customColorTarget: {
    width: '12.5%',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  customColorSelected: {
    backgroundColor: 'rgba(232,66,15,0.12)',
  },
  customColorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
});
