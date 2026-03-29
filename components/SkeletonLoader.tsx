import React from 'react';
import { View, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { useColorScheme } from '@/hooks/useColorScheme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const isDark = useColorScheme() === 'dark';
  const baseColor = isDark ? '#1e293b' : '#e2e8f0';
  const highlightColor = isDark ? '#334155' : '#f8fafc';

  return (
    <MotiView
      from={{ backgroundColor: baseColor }}
      animate={{ backgroundColor: highlightColor }}
      transition={{
        type: 'timing',
        duration: 800,
        loop: true,
      }}
      style={[
        {
          width: width as any,
          height,
          borderRadius,
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
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
      }}
    >
      {/* Icon + title row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Skeleton width="60%" height={14} style={{ marginBottom: 6 }} />
          <Skeleton width="40%" height={11} />
        </View>
      </View>
      {/* Text lines */}
      <Skeleton width="100%" height={11} style={{ marginBottom: 6 }} />
      <Skeleton width="85%" height={11} style={{ marginBottom: 6 }} />
      <Skeleton width="70%" height={11} />
    </View>
  );
}
