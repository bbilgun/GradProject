import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Palette } from '@/constants/Theme';

interface Props {
  size?: number;
}

export function LoadingSpinner({ size = 28 }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;
  const goldScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(goldScale, { toValue: 1.5, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(goldScale, { toValue: 1, duration: 450, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const strokeWidth = Math.max(2, size * 0.1);
  const dotSize = size * 0.18;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Blue ring */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: Palette.primary,
          borderTopColor: 'transparent',
          transform: [{ rotate: spin }],
        }}
      />
      {/* Gold accent dot */}
      <Animated.View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: Palette.gold,
          transform: [{ scale: goldScale }],
        }}
      />
    </View>
  );
}
