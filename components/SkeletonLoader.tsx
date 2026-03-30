import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, ViewStyle } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Palette, EaseOutExpo } from '@/constants/Theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const isDark = useColorScheme() === 'dark';
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: isDark ? '#1A1D2E' : '#E9ECF5',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SearchResultSkeleton() {
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={{
      backgroundColor: isDark ? Palette.dark.card : Palette.card,
      borderWidth: 1,
      borderColor: isDark ? Palette.dark.border : Palette.border,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Skeleton width={36} height={36} borderRadius={9} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Skeleton width="55%" height={13} style={{ marginBottom: 6 }} />
          <Skeleton width="35%" height={10} />
        </View>
      </View>
      <Skeleton width="100%" height={10} style={{ marginBottom: 6 }} />
      <Skeleton width="88%"  height={10} style={{ marginBottom: 6 }} />
      <Skeleton width="72%"  height={10} />
    </View>
  );
}
