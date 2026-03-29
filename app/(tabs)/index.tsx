import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { CategoryCard } from '@/components/CategoryCard';
import HandbookService from '@/services/handbook_service';
import { useColorScheme } from '@/hooks/useColorScheme';

const sections = HandbookService.getAllSections();

// Split into pairs for 2-column grid
const rows: (typeof sections)[] = [];
for (let i = 0; i < sections.length; i += 2) {
  rows.push(sections.slice(i, i + 2));
}

export default function HomeScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-secondary-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-6 pb-4">
          <View className="flex-row items-center justify-between mb-1">
            <View>
              <Text
                className="text-2xl font-bold"
                style={{ color: isDark ? '#fff' : '#0f172a' }}
              >
                ШУТИС Гарын Авлага
              </Text>
              <Text
                className="text-sm mt-0.5"
                style={{ color: isDark ? 'rgba(255,255,255,0.55)' : '#64748b' }}
              >
                Оюутны бүх мэдээлэл нэг дороос
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/search' as any)}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
            >
              <MaterialIcons
                name="search"
                size={22}
                color={isDark ? '#94a3b8' : '#475569'}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Assistant Banner */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/ai-assistant' as any)}
          activeOpacity={0.85}
          className="mx-5 mb-5 rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#0284c7' }}
        >
          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-1 mr-3">
              <Text className="text-white font-bold text-base mb-0.5">
                AI Туслах
              </Text>
              <Text className="text-white/80 text-sm">
                Гарын авлагаас AI-аар хайлт хийх, тайлбар авах
              </Text>
            </View>
            <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center">
              <MaterialIcons name="auto-awesome" size={26} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>

        {/* Section Grid */}
        <View className="px-5">
          <Text
            className="font-semibold text-base mb-3"
            style={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }}
          >
            БҮЛГҮҮД
          </Text>

          {rows.map((row, rowIndex) => (
            <View key={rowIndex} className="flex-row gap-3 mb-3">
              {row.map((section) => (
                <View key={section.id} className="flex-1">
                  <CategoryCard
                    section={section}
                    onPress={(s) =>
                      router.push({
                        pathname: '/handbook/[slug]' as any,
                        params: { slug: s.id },
                      })
                    }
                  />
                </View>
              ))}
              {/* Fill empty slot if odd row */}
              {row.length === 1 && <View className="flex-1" />}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
