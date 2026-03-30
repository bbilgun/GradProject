import { View } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Palette } from '@/constants/Theme';

export default function TabBarBackground() {
  const isDark = useColorScheme() === 'dark';
  return (
    <View
      style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: isDark ? Palette.dark.card : Palette.card,
        borderTopWidth: 1,
        borderTopColor: isDark ? Palette.dark.divider : Palette.divider,
      }}
    />
  );
}
