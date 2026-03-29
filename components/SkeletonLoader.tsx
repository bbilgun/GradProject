import React, { useEffect, useRef } from 'react';
import { View, Animated, ViewStyle } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const isDark = useColorScheme() === 'dark';
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
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
          backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SearchResultSkeleton() {
  const isDark = useColorScheme() === 'dark';
  const cardBg = isDark ? '#1e293b' : '#f8fafc';

  return (
    <View style={{ backgroundColor: cardBg, borderRadius: 16, padding: 16, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="40%" height={11} />
        </View>
      </View>
      <Skeleton width="100%" height={11} style={{ marginBottom: 6 }} />
      <Skeleton width="85%" height={11} style={{ marginBottom: 6 }} />
      <Skeleton width="70%" height={11} />
    </View>
  );
}
