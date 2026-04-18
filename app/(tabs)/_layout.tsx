import { Tabs, useRouter, usePathname } from 'expo-router';
import { Platform, TouchableOpacity, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Palette } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const isDark   = useColorScheme() === 'dark';
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const pathname = usePathname();
  const isAIScreen = pathname === '/ai-assistant';
  // Tab bar height: 49pt content + bottom inset
  const fabBottom = insets.bottom + 49 + 12;

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Palette.primary,
          tabBarInactiveTintColor: isDark ? Palette.dark.muted : Palette.muted,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          animation: 'fade',
          tabBarStyle: Platform.select({
            ios: {
              position: 'absolute',
              borderTopWidth: 0,
              elevation: 0,
            },
            default: {
              borderTopWidth: 0,
              elevation: 0,
            },
          }),
          tabBarLabelStyle: {
            fontFamily: 'Inter_500Medium',
            fontSize: 11,
            letterSpacing: 0.2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Нүүр',
            tabBarIcon: ({ color }) => <MaterialIcons name="home" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="ai-assistant"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="news"
          options={{
            title: 'Мэдээ',
            tabBarIcon: ({ color }) => <MaterialIcons name="campaign" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Баримт',
            tabBarIcon: ({ color }) => <MaterialIcons name="folder-open" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Профайл',
            tabBarIcon: ({ color }) => <MaterialIcons name="account-circle" size={24} color={color} />,
          }}
        />
      </Tabs>

      {!isAIScreen && <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={() => router.push('/(tabs)/ai-assistant')}
        activeOpacity={0.85}
        accessibilityLabel="AI Туслах нээх"
        accessibilityRole="button"
      >
        <MaterialIcons name="auto-awesome" size={26} color="#fff" />
      </TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});
