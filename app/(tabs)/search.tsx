import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Keyboard,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { SearchResultSkeleton } from '@/components/SkeletonLoader';
import HandbookService, { HandbookSection } from '@/services/handbook_service';
import { Config } from '@/constants/config';
import { useColorScheme } from '@/hooks/useColorScheme';

interface SearchResult {
  section: HandbookSection;
  snippet: string;
  score: number;
}

export default function SearchScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch(Config.SEARCH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, top_k: 6 }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();

      const mapped: SearchResult[] = (data.results ?? []).map((r: any) => {
        const section = HandbookService.getSectionBySlug(r.section_id) ?? {
          id: r.section_id,
          title: r.section_title ?? r.section_id,
          titleEn: '',
          description: '',
          icon: 'article',
          color: '#EFF6FF',
          darkColor: '#1E3A5F',
          content: '',
        };
        return { section, snippet: r.text ?? '', score: r.score ?? 0 };
      });
      setResults(mapped);
    } catch {
      const offline = HandbookService.searchLocal(q);
      setResults(offline.map((s) => ({ section: s, snippet: s.description, score: 1 })));
    } finally {
      setLoading(false);
    }
  }, []);

  const inputBg = isDark ? '#1e293b' : '#f1f5f9';
  const inputColor = isDark ? '#f8fafc' : '#0f172a';
  const placeholderColor = isDark ? '#64748b' : '#94a3b8';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: isDark ? '#0f172a' : '#fff' }}>
      {/* Header */}
      <View className="px-5 pt-5 pb-3">
        <Text className="text-2xl font-bold mb-4" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
          Хайлт
        </Text>

        <View
          className="flex-row items-center rounded-2xl px-4"
          style={{ backgroundColor: inputBg, height: 50 }}
        >
          <MaterialIcons name="search" size={22} color={placeholderColor} />
          <TextInput
            ref={inputRef}
            className="flex-1 ml-2 text-base"
            style={{ color: inputColor }}
            placeholder="Тэтгэлэг, кредит, хичээл..."
            placeholderTextColor={placeholderColor}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => doSearch(query)}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <MaterialIcons name="cancel" size={18} color={placeholderColor} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          onPress={() => doSearch(query)}
          disabled={!query.trim() || loading}
          className="mt-3 rounded-2xl py-3 items-center"
          style={{ backgroundColor: query.trim() ? '#0284c7' : (isDark ? '#1e293b' : '#e2e8f0') }}
        >
          <Text
            className="font-semibold text-base"
            style={{ color: query.trim() ? '#fff' : placeholderColor }}
          >
            Хайх
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-5"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Shimmer skeleton while loading */}
        {loading && (
          <View>
            {[1, 2, 3, 4].map((i) => (
              <SearchResultSkeleton key={i} />
            ))}
          </View>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <FadeIn>
            <Text
              className="text-xs font-semibold mb-3 mt-1"
              style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8' }}
            >
              {results.length} үр дүн олдлоо
            </Text>
            {results.map((r, idx) => (
              <SearchResultCard
                key={`${r.section.id}-${idx}`}
                result={r}
                isDark={isDark}
                onPress={() =>
                  router.push({ pathname: '/handbook/[slug]' as any, params: { slug: r.section.id } })
                }
              />
            ))}
          </FadeIn>
        )}

        {/* Empty state */}
        {!loading && searched && results.length === 0 && (
          <FadeIn>
            <View className="items-center mt-16">
              <MaterialIcons name="search-off" size={48} color={isDark ? '#334155' : '#cbd5e1'} />
              <Text className="mt-3 text-base font-semibold" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
                Үр дүн олдсонгүй
              </Text>
              <Text className="text-sm mt-1 text-center" style={{ color: isDark ? '#334155' : '#cbd5e1' }}>
                Өөр түлхүүр үг ашиглаад дахин хайна уу
              </Text>
            </View>
          </FadeIn>
        )}

        {!loading && !searched && <QuickAccess isDark={isDark} onChipPress={(q) => doSearch(q)} />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────
// Fade-in wrapper using built-in Animated

function FadeIn({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────

function SearchResultCard({
  result,
  isDark,
  onPress,
}: {
  result: SearchResult;
  isDark: boolean;
  onPress: () => void;
}) {
  const cardBg = isDark ? '#1e293b' : '#f8fafc';
  const sectionBg = isDark ? result.section.darkColor : result.section.color;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={{ backgroundColor: cardBg, borderRadius: 16, padding: 14, marginBottom: 10 }}
    >
      <View className="flex-row items-center mb-2">
        <View
          style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: sectionBg,
            alignItems: 'center', justifyContent: 'center', marginRight: 10,
          }}
        >
          <MaterialIcons name={result.section.icon as any} size={20} color={isDark ? '#fff' : '#1e3a5f'} />
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-sm" style={{ color: isDark ? '#f1f5f9' : '#0f172a' }} numberOfLines={1}>
            {result.section.title}
          </Text>
          <Text className="text-xs" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            {result.section.titleEn}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={isDark ? '#475569' : '#cbd5e1'} />
      </View>

      {result.snippet ? (
        <Text className="text-sm leading-5" style={{ color: isDark ? '#94a3b8' : '#475569' }} numberOfLines={3}>
          {result.snippet}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const QUICK_CHIPS = [
  'Тэтгэлэг', 'Кредит', 'Хичээл сонголт', 'Байр',
  'Эрүүл мэнд', 'Виз', 'Дипломын хамгаалалт', 'Солилцооны хөтөлбөр',
];

function QuickAccess({ isDark, onChipPress }: { isDark: boolean; onChipPress: (q: string) => void }) {
  return (
    <View className="mt-2">
      <Text className="text-xs font-semibold mb-3" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8' }}>
        ХУРДАН ХАЙЛТ
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {QUICK_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip}
            onPress={() => onChipPress(chip)}
            style={{ backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 }}
          >
            <Text className="text-sm" style={{ color: isDark ? '#94a3b8' : '#475569' }}>{chip}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
