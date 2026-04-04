import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Palette } from '@/constants/Theme';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const isDark = useColorScheme() === 'dark';

  return (
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
          title: 'Хадгалсан',
          tabBarIcon: ({ color }) => <MaterialIcons name="bookmark" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai-assistant"
        options={{
          title: 'AI Туслах',
          tabBarIcon: ({ color }) => <MaterialIcons name="auto-awesome" size={24} color={color} />,
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
  );
}
