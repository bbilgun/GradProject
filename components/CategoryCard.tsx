import React, { useRef } from 'react';
import { TouchableOpacity, Text, View, Animated, Easing } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { Palette, EaseOutExpo } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { HandbookSection } from '@/services/handbook_service';

interface CategoryCardProps {
  section: HandbookSection;
  onPress: (section: HandbookSection) => void;
  style?: object;
}

export function CategoryCard({ section, onPress, style }: CategoryCardProps) {
  const isDark = useColorScheme() === 'dark';
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 120,
      easing: Easing.bezier(...EaseOutExpo),
      useNativeDriver: true,
    }).start();

  const handlePressOut = () =>
    Animated.timing(scale, {
      toValue: 1,
      duration: 200,
      easing: Easing.bezier(...EaseOutExpo),
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale }],
          borderRadius: 16,
          backgroundColor: isDark ? Palette.dark.card : Palette.card,
          borderWidth: 1,
          borderColor: isDark ? Palette.dark.border : Palette.border,
          minHeight: 130,
          flex: 1,
        },
        style,
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => onPress(section)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}
      >
        {/* Icon badge */}
        <View
          style={{
            width: 40, height: 40, borderRadius: 10,
            backgroundColor: isDark ? 'rgba(8,21,143,0.25)' : 'rgba(8,21,143,0.08)',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <MaterialIcons
            name={section.icon as any}
            size={20}
            color={Palette.primary}
          />
        </View>

        <View>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: 'Inter_600SemiBold',
              fontSize: 13,
              lineHeight: 18,
              color: isDark ? Palette.dark.heading : Palette.heading,
              marginBottom: 4,
            }}
          >
            {section.title}
          </Text>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: 'Inter_400Regular',
              fontSize: 11,
              lineHeight: 15,
              color: isDark ? Palette.dark.muted : Palette.muted,
            }}
          >
            {section.description}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
