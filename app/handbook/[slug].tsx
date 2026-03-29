import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import HandbookService from '@/services/handbook_service';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ContentDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const { width } = useWindowDimensions();

  const section = HandbookService.getSectionBySlug(slug ?? '');

  if (!section) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white dark:bg-secondary-900">
        <Text className="text-secondary-500 text-base">Мэдээлэл олдсонгүй</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-primary-600 font-semibold">Буцах</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const bgColor = isDark ? section.darkColor : section.color;

  const handleSummarizeWithAI = () => {
    const context = HandbookService.getAIContext(slug ?? '');
    router.push({
      pathname: '/(tabs)/ai-assistant' as any,
      params: {
        context,
        sectionTitle: section.title,
      },
    });
  };

  const markdownStyles = {
    body: {
      color: isDark ? '#e2e8f0' : '#1e293b',
      fontSize: 15,
      lineHeight: 24,
      fontFamily: 'System',
    },
    heading1: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontSize: 22,
      fontWeight: '700' as const,
      marginTop: 8,
      marginBottom: 12,
    },
    heading2: {
      color: isDark ? '#f1f5f9' : '#1e293b',
      fontSize: 18,
      fontWeight: '700' as const,
      marginTop: 20,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      paddingBottom: 4,
    },
    heading3: {
      color: isDark ? '#e2e8f0' : '#334155',
      fontSize: 16,
      fontWeight: '600' as const,
      marginTop: 16,
      marginBottom: 6,
    },
    paragraph: {
      color: isDark ? '#cbd5e1' : '#334155',
      marginBottom: 10,
      lineHeight: 24,
    },
    strong: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontWeight: '700' as const,
    },
    em: {
      color: isDark ? '#93c5fd' : '#0284c7',
      fontStyle: 'italic' as const,
    },
    bullet_list: { marginBottom: 10 },
    list_item: {
      color: isDark ? '#cbd5e1' : '#334155',
      marginBottom: 4,
    },
    blockquote: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(2,132,199,0.07)',
      borderLeftWidth: 3,
      borderLeftColor: '#0284c7',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
      marginVertical: 8,
    },
    code_inline: {
      backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
      color: isDark ? '#7dd3fc' : '#0369a1',
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 13,
      fontFamily: 'SpaceMono',
    },
    fence: {
      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
      borderRadius: 8,
      padding: 12,
      marginVertical: 10,
    },
    table: {
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
      borderRadius: 8,
      marginVertical: 10,
      overflow: 'hidden' as const,
    },
    thead: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
    },
    th: {
      color: isDark ? '#f8fafc' : '#0f172a',
      fontWeight: '700' as const,
      padding: 10,
      borderRightWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    },
    td: {
      color: isDark ? '#cbd5e1' : '#334155',
      padding: 10,
      borderRightWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0',
    },
    hr: {
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
      marginVertical: 16,
    },
    link: {
      color: '#0284c7',
    },
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff' }}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header with hero color band */}
      <View style={{ backgroundColor: bgColor }} className="px-5 pt-4 pb-5">
        <TouchableOpacity
          onPress={() => router.back()}
          className="flex-row items-center mb-3"
        >
          <MaterialIcons
            name="arrow-back"
            size={22}
            color={isDark ? '#fff' : '#1e293b'}
          />
          <Text
            className="ml-2 font-medium text-sm"
            style={{ color: isDark ? '#fff' : '#1e293b' }}
          >
            Буцах
          </Text>
        </TouchableOpacity>

        <View className="flex-row items-center">
          <View
            className="w-11 h-11 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.3)' }}
          >
            <MaterialIcons
              name={section.icon as any}
              size={24}
              color={isDark ? '#fff' : '#1e3a5f'}
            />
          </View>
          <View className="flex-1">
            <Text
              className="text-xl font-bold leading-tight"
              style={{ color: isDark ? '#fff' : '#0f172a' }}
            >
              {section.title}
            </Text>
            <Text
              className="text-sm mt-0.5"
              style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' }}
            >
              {section.titleEn}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Markdown style={markdownStyles}>{section.content}</Markdown>
      </ScrollView>

      {/* Summarize with AI — floating button */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-3"
        style={{
          backgroundColor: isDark
            ? 'rgba(15,23,42,0.95)'
            : 'rgba(255,255,255,0.95)',
        }}
      >
        <TouchableOpacity
          onPress={handleSummarizeWithAI}
          activeOpacity={0.85}
          className="rounded-2xl py-4 flex-row items-center justify-center gap-2"
          style={{ backgroundColor: '#0284c7' }}
        >
          <MaterialIcons name="auto-awesome" size={20} color="#fff" />
          <Text className="text-white font-bold text-base">
            AI-аар хураангуйлах
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
