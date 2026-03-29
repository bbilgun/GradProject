import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/useColorScheme';

import type { HandbookSection } from '@/services/handbook_service';

interface CategoryCardProps {
  section: HandbookSection;
  onPress: (section: HandbookSection) => void;
}

export function CategoryCard({ section, onPress }: CategoryCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bgColor = isDark ? section.darkColor : section.color;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onPress(section)}
      style={{ backgroundColor: bgColor }}
      className="rounded-2xl p-4 flex-1 min-h-[130px] justify-between"
    >
      <View className="w-10 h-10 rounded-full bg-white/30 items-center justify-center mb-3">
        <MaterialIcons
          name={section.icon as any}
          size={22}
          color={isDark ? '#fff' : '#1e3a5f'}
        />
      </View>

      <View>
        <Text
          numberOfLines={2}
          className="font-bold text-sm leading-tight mb-1"
          style={{ color: isDark ? '#fff' : '#1e293b' }}
        >
          {section.title}
        </Text>
        <Text
          numberOfLines={2}
          className="text-xs leading-tight"
          style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)' }}
        >
          {section.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
