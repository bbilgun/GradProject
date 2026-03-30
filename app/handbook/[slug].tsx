import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Markdown from 'react-native-markdown-display';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import HandbookService from '@/services/handbook_service';
import { useBookmarks } from '@/contexts/BookmarkContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Palette } from '@/constants/Theme';

export default function ContentDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const { toggle, isBookmarked } = useBookmarks();
  const section = HandbookService.getSectionBySlug(slug ?? '');

  if (!section) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? Palette.dark.bg : Palette.bg }}>
        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 15, color: isDark ? Palette.dark.muted : Palette.muted }}>
          Мэдээлэл олдсонгүй
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', color: Palette.primary }}>Буцах</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleSummarizeWithAI = () => {
    router.push({
      pathname: '/(tabs)/ai-assistant' as any,
      params: { context: HandbookService.getAIContext(slug ?? ''), sectionTitle: section.title },
    });
  };

  const markdownStyles = {
    body: {
      color: isDark ? Palette.dark.body : Palette.body,
      fontSize: 15,
      lineHeight: 26,
      fontFamily: 'Inter_400Regular',
      letterSpacing: 0.1,
    },
    heading1: {
      color: isDark ? Palette.dark.heading : Palette.heading,
      fontSize: 22,
      fontFamily: 'Inter_700Bold',
      letterSpacing: -0.4,
      marginTop: 8,
      marginBottom: 12,
    },
    heading2: {
      color: isDark ? Palette.dark.heading : Palette.heading,
      fontSize: 18,
      fontFamily: 'Inter_700Bold',
      letterSpacing: -0.3,
      marginTop: 22,
      marginBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? Palette.dark.divider : Palette.divider,
      paddingBottom: 6,
    },
    heading3: {
      color: isDark ? Palette.dark.heading : Palette.heading,
      fontSize: 16,
      fontFamily: 'Inter_600SemiBold',
      marginTop: 18,
      marginBottom: 6,
    },
    paragraph: {
      color: isDark ? Palette.dark.body : Palette.body,
      marginBottom: 12,
      lineHeight: 26,
    },
    strong: {
      color: isDark ? Palette.dark.heading : Palette.heading,
      fontFamily: 'Inter_700Bold',
    },
    em: {
      color: isDark ? '#93C5FD' : Palette.primary,
      fontStyle: 'italic' as const,
    },
    bullet_list: { marginBottom: 12 },
    list_item: {
      color: isDark ? Palette.dark.body : Palette.body,
      marginBottom: 5,
      lineHeight: 24,
    },
    blockquote: {
      backgroundColor: isDark ? 'rgba(8,21,143,0.12)' : 'rgba(8,21,143,0.05)',
      borderLeftWidth: 3,
      borderLeftColor: Palette.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 6,
      marginVertical: 10,
    },
    code_inline: {
      backgroundColor: isDark ? '#1A1D2E' : '#EEF2FF',
      color: isDark ? '#93C5FD' : Palette.primary,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 13,
      fontFamily: 'SpaceMono',
    },
    fence: {
      backgroundColor: isDark ? '#1A1D2E' : '#F8F9FA',
      borderRadius: 10,
      padding: 14,
      marginVertical: 12,
    },
    table: {
      borderWidth: 1,
      borderColor: isDark ? Palette.dark.border : Palette.border,
      borderRadius: 10,
      marginVertical: 12,
      overflow: 'hidden' as const,
    },
    thead: {
      backgroundColor: isDark ? 'rgba(8,21,143,0.2)' : 'rgba(8,21,143,0.06)',
    },
    th: {
      color: isDark ? Palette.dark.heading : Palette.heading,
      fontFamily: 'Inter_700Bold',
      padding: 10,
      borderRightWidth: 1,
      borderColor: isDark ? Palette.dark.border : Palette.border,
    },
    td: {
      color: isDark ? Palette.dark.body : Palette.body,
      fontFamily: 'Inter_400Regular',
      padding: 10,
      borderRightWidth: 1,
      borderColor: isDark ? Palette.dark.border : Palette.border,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: isDark ? Palette.dark.divider : Palette.divider,
    },
    hr: {
      borderColor: isDark ? Palette.dark.border : Palette.border,
      marginVertical: 18,
    },
    link: {
      color: Palette.primary,
    },
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? Palette.dark.bg : Palette.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header — Primary Blue */}
      <View style={{ backgroundColor: Palette.primary, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
            <Text style={{ marginLeft: 8, fontFamily: 'Inter_500Medium', fontSize: 14, color: '#fff' }}>
              Буцах
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => toggle(slug ?? '')}
            style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MaterialIcons
              name={isBookmarked(slug ?? '') ? 'bookmark' : 'bookmark-border'}
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: 'rgba(255,255,255,0.18)',
            alignItems: 'center', justifyContent: 'center',
            marginRight: 12,
          }}>
            <MaterialIcons name={section.icon as any} size={24} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.4, color: '#fff', lineHeight: 26 }}>
              {section.title}
            </Text>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
              {section.titleEn}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Markdown style={markdownStyles}>{section.content}</Markdown>
      </ScrollView>

      {/* AI Summary button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingBottom: 32, paddingTop: 14,
        backgroundColor: isDark ? 'rgba(15,17,23,0.97)' : 'rgba(248,249,250,0.97)',
        borderTopWidth: 1,
        borderTopColor: isDark ? Palette.dark.divider : Palette.divider,
      }}>
        <TouchableOpacity
          onPress={handleSummarizeWithAI}
          activeOpacity={0.88}
          style={{
            borderRadius: 14,
            paddingVertical: 15,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: Palette.primary,
          }}
        >
          <MaterialIcons name="auto-awesome" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: 0.2 }}>
            AI-аар хураангуйлах
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
