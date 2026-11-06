import React from 'react';
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
type AnimatedTextInputProps = TextInputProps & { text: string };

function groupedRupees(amount: number) {
  'worklet';
  const roundedCents = Math.round(Math.abs(amount) * 100);
  const rounded = Math.floor(roundedCents / 100);
  const cents = String(roundedCents % 100).padStart(2, '0');
  const digits = String(rounded);
  const lastThree = digits.slice(-3);
  const remaining = digits.slice(0, -3);
  const grouped =
    remaining.length > 0
      ? `${remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}`
      : lastThree;
  return `${amount < 0 ? '−' : ''}₹${grouped}.${cents}`;
}

type Props = Omit<TextInputProps, 'value' | 'defaultValue'> & {
  amount: number;
  animate?: boolean;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
};

export default function AnimatedNumber({
  amount,
  animate = true,
  adjustsFontSizeToFit = false,
  minimumFontScale = 0.6,
  ...props
}: Props) {
  const reduceMotion = useReducedMotion();
  const animatedAmount = useSharedValue(amount);

  React.useEffect(() => {
    animatedAmount.value = reduceMotion || !animate
      ? amount
      : withTiming(amount, { duration: 600 });
  }, [amount, animate, animatedAmount, reduceMotion]);

  const animatedProps = useAnimatedProps<AnimatedTextInputProps>(() => ({
    text: groupedRupees(animatedAmount.value),
  }));
  const flatStyle = StyleSheet.flatten(props.style) as TextStyle | undefined;
  const baseFontSize = flatStyle?.fontSize ?? 16;
  const formattedLength = groupedRupees(amount).length;
  const fittedFontSize =
    adjustsFontSizeToFit && formattedLength > 12
      ? baseFontSize * Math.max(minimumFontScale, 12 / formattedLength)
      : baseFontSize;

  return (
    <AnimatedTextInput
      {...props}
      accessible={Boolean(props.accessibilityLabel)}
      editable={false}
      focusable={false}
      underlineColorAndroid="transparent"
      defaultValue={groupedRupees(amount)}
      animatedProps={animatedProps}
      style={[props.style, { fontSize: fittedFontSize }]}
    />
  );
}
