import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useBookmarks, SavedNewsItem } from '@/contexts/BookmarkContext';
import HandbookService from '@/services/handbook_service';
import { Config } from '@/constants/config';
import { EaseOutExpo, Space } from '@/constants/Theme';

// ─── Design tokens ────────────────────────────────────────────────

const BLUE   = '#08158F';
const BLUE2  = '#0A1DB8';
const BLUE3  = '#1833D6';
const GOLD   = '#FFC20D';
const BG     = '#F8F9FA';
const WHITE  = '#FFFFFF';
const MUTED  = '#6B7280';
const BODY   = '#1A1A2E';
const BORDER = 'rgba(8,21,143,0.09)';

const EASE = Easing.bezier(...EaseOutExpo);

type Tab = 'handbook' | 'news';

function toUtc(iso: string) {
  return new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z');
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - toUtc(iso).getTime()) / 1000);
  if (diff < 60)    return 'Яг одоо';
  if (diff < 3600)  return `${Math.floor(diff / 60)}м өмнө`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ц өмнө`;
  return toUtc(iso).toLocaleDateString('mn-MN', { month: 'short', day: 'numeric' });
}

// ─── Screen ───────────────────────────────────────────────────────

export default function BookmarksScreen() {
  const router = useRouter();
  const { bookmarks, toggle, savedNews, toggleNews } = useBookmarks();
  const [activeTab, setActiveTab] = useState<Tab>('handbook');

  const savedSections = HandbookService.getAllSections().filter(s => bookmarks.has(s.id));
  const savedNewsItems = Array.from(savedNews.values());
  const totalCount = savedSections.length + savedNewsItems.length;

  // Build rows of 2 for handbook
  const rows: (typeof savedSections)[] = [];
  for (let i = 0; i < savedSections.length; i += 2) {
    rows.push(savedSections.slice(i, i + 2));
  }

  // Header entrance animation
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerY  = useRef(new Animated.Value(-10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOp, { toValue: 1, duration: 380, easing: EASE, useNativeDriver: true }),
      Animated.timing(headerY,  { toValue: 0, duration: 380, easing: EASE, useNativeDriver: true }),
    ]).start();
  }, []);

  const currentEmpty = activeTab === 'handbook' ? savedSections.length === 0 : savedNewsItems.length === 0;

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      {/* ── Blue header ─────────────────────────────────────── */}
      <LinearGradient
        colors={[BLUE, BLUE2, BLUE3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.hero}
      >
        <View style={st.orbGold} />
        <View style={st.orbBlue} />
        <View style={st.orbTiny} />
        <SafeAreaView edges={['top']}>
        <Animated.View style={[st.headerInner, { opacity: headerOp, transform: [{ translateY: headerY }] }]}>
          {/* Top row: logo */}
          <View style={st.headerTopRow}>
            <Image
              source={require('@/assets/images/main_logo.png')}
              style={st.headerLogo}
              resizeMode="contain"
            />
            <View style={st.headerIconWrap}>
              <MaterialIcons name="bookmark" size={19} color={GOLD} />
            </View>
          </View>
          <Text style={st.headerTitle}>Хадгалсан</Text>
          <View style={st.headerMeta}>
            {totalCount > 0 && (
              <View style={st.countBadge}>
                <Text style={st.countBadgeText}>{totalCount} зүйл</Text>
              </View>
            )}
            <Text style={st.headerSubtitle}>
              {totalCount > 0 ? 'хадгалагдсан' : 'Хадгалсан зүйл байхгүй байна'}
            </Text>
          </View>

          {/* ── Segment tabs ─────────────────────────────────── */}
          <View style={st.segmentRow}>
            <TouchableOpacity
              style={[st.segmentBtn, activeTab === 'handbook' && st.segmentBtnActive]}
              onPress={() => setActiveTab('handbook')}
            >
              <MaterialIcons
                name="menu-book"
                size={14}
                color={activeTab === 'handbook' ? BLUE : 'rgba(255,255,255,0.6)'}
              />
              <Text style={[st.segmentText, activeTab === 'handbook' && st.segmentTextActive]}>
                Гарын авлага ({savedSections.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.segmentBtn, activeTab === 'news' && st.segmentBtnActive]}
              onPress={() => setActiveTab('news')}
            >
              <MaterialIcons
                name="campaign"
                size={14}
                color={activeTab === 'news' ? BLUE : 'rgba(255,255,255,0.6)'}
              />
              <Text style={[st.segmentText, activeTab === 'news' && st.segmentTextActive]}>
                Мэдээ ({savedNewsItems.length})
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
        </SafeAreaView>
        {/* Rounded bottom edge */}
        <View style={st.headerCurve} />
      </LinearGradient>

      {/* ── Content ─────────────────────────────────────────── */}
      {currentEmpty ? (
        <EmptyState
          tab={activeTab}
          onBrowse={() => router.push(activeTab === 'handbook' ? '/(tabs)/explore' as any : '/(tabs)/news' as any)}
        />
      ) : activeTab === 'handbook' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Space.gutter, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={st.handbookRow}>
              {row[0] && (
                <HandbookCard
                  section={row[0]}
                  onPress={() => router.push({ pathname: '/handbook/[slug]' as any, params: { slug: row[0].id } })}
                  onRemove={() => toggle(row[0].id)}
                />
              )}
              {row[1] ? (
                <HandbookCard
                  section={row[1]}
                  onPress={() => router.push({ pathname: '/handbook/[slug]' as any, params: { slug: row[1].id } })}
                  onRemove={() => toggle(row[1].id)}
                />
              ) : (
                <View style={{ flex: 1 }} />
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          {savedNewsItems.map((item) => (
            <SavedNewsCard
              key={item.id}
              item={item}
              onPress={() => router.push(`/news/${item.id}` as any)}
              onRemove={() => toggleNews(item)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Handbook Bookmark Card ─────────────────────────────────────────

function HandbookCard({
  section, onPress, onRemove,
}: {
  section: ReturnType<typeof HandbookService.getAllSections>[number];
  onPress: () => void;
  onRemove: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn  = () => Animated.timing(scale, { toValue: 0.96, duration: 100, easing: EASE, useNativeDriver: true }).start();
  const pressOut = () => Animated.timing(scale, { toValue: 1,    duration: 180, easing: EASE, useNativeDriver: true }).start();

  return (
    <Animated.View style={[st.hbCardWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={st.hbCard}
      >
        <View style={st.hbCardTopRow}>
          <View style={st.hbIconWrap}>
            <MaterialIcons name={section.icon as any} size={24} color={BLUE} />
          </View>
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={st.hbRemoveBtn}
          >
            <MaterialIcons name="bookmark" size={16} color={BLUE} />
          </TouchableOpacity>
        </View>
        <View>
          <Text numberOfLines={2} style={st.hbTitle}>{section.title}</Text>
          <Text numberOfLines={1} style={st.hbDesc}>{section.description}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Saved News Card ─────────────────────────────────────────────────

function SavedNewsCard({
  item, onPress, onRemove,
}: {
  item: SavedNewsItem;
  onPress: () => void;
  onRemove: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const snippet = item.sections[0]?.body ?? item.content ?? '';

  function coverSource() {
    if (!item.cover_image_url) return require('@/assets/images/news_main.jpg');
    return {
      uri: item.cover_image_url.startsWith('http')
        ? item.cover_image_url
        : `${Config.API_BASE}${item.cover_image_url}`,
    };
  }

  return (
    <Animated.View style={[st.newsCardWrap, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        style={st.newsCard}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }).start()}
      >
        <View style={st.newsThumbWrap}>
          <Image source={coverSource()} style={st.newsThumb} resizeMode="cover" />
          {item.is_special && (
            <View style={st.specialTag}>
              <MaterialIcons name="star" size={8} color={BODY} />
              <Text style={st.specialTagText}>ОНЦЛОХ</Text>
            </View>
          )}
        </View>
        <View style={st.newsBody}>
          <Text style={st.newsTitle} numberOfLines={2}>{item.title}</Text>
          {!!snippet && (
            <Text style={st.newsSnippet} numberOfLines={2}>{snippet}</Text>
          )}
          <View style={st.newsFooter}>
            <View style={st.metaRow}>
              <MaterialIcons name="access-time" size={11} color={MUTED} />
              <Text style={st.newsMeta}>{timeAgo(item.created_at)}</Text>
            </View>
            <TouchableOpacity
              onPress={onRemove}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={st.newsRemoveBtn}
            >
              <MaterialIcons name="bookmark" size={16} color={GOLD} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function EmptyState({ tab, onBrowse }: { tab: Tab; onBrowse: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const op    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(op, { toValue: 1, duration: 400, easing: EASE, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const isNews = tab === 'news';

  return (
    <Animated.View style={st.emptyWrap}>
      <Animated.View style={[st.emptyIconWrap, { transform: [{ scale: pulse }], opacity: op }]}>
        <MaterialIcons
          name={isNews ? 'newspaper' : 'bookmark-border'}
          size={36}
          color="rgba(8,21,143,0.35)"
        />
      </Animated.View>

      <Animated.View style={{ opacity: op, alignItems: 'center' }}>
        <Text style={st.emptyTitle}>
          {isNews ? 'Хадгалсан мэдээ байхгүй' : 'Хадгалсан бүлэг байхгүй'}
        </Text>
        <Text style={st.emptyBody}>
          {isNews
            ? 'Мэдээний хавчуур товчийг дарж хадгалаарай'
            : 'Бүлгийн дээр дарахад гарах хавчуур товчийг дарж хадгалаарай'}
        </Text>

        <TouchableOpacity onPress={onBrowse} style={st.emptyBtn}>
          <Text style={st.emptyBtnText}>
            {isNews ? 'Мэдээ үзэх' : 'Бүлгүүд үзэх'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Hero
  hero: { paddingBottom: 38, overflow: 'hidden' },
  orbGold: {
    position: 'absolute',
    top: -60, right: -50,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: GOLD, opacity: 0.12,
  },
  orbBlue: {
    position: 'absolute',
    top: 40, left: -80,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: '#FFFFFF', opacity: 0.05,
  },
  orbTiny: {
    position: 'absolute',
    top: 90, right: 60,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: GOLD, opacity: 0.8,
  },

  // Header
  headerInner: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerLogo: { width: 36, height: 36, borderRadius: 8 },
  headerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.13)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, color: WHITE, letterSpacing: -0.5, marginBottom: 4 },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  countBadge: { backgroundColor: GOLD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  countBadgeText: { fontFamily: 'Inter_700Bold', fontSize: 11, color: BODY },
  headerSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: 'rgba(255,255,255,0.60)' },
  headerCurve: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 40, backgroundColor: BG,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
  },

  // Segment tabs
  segmentRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: 4,
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
  },
  segmentBtnActive: { backgroundColor: WHITE },
  segmentText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  segmentTextActive: { color: BLUE },

  // Handbook cards
  handbookRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  hbCardWrap: { flex: 1 },
  hbCard: {
    backgroundColor: WHITE, borderRadius: 16, padding: 16,
    minHeight: 138, borderWidth: 1, borderColor: BORDER,
    shadowColor: 'rgba(8,21,143,0.06)', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 2,
    justifyContent: 'space-between',
  },
  hbCardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  hbIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(8,21,143,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  hbRemoveBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(8,21,143,0.06)',
    alignItems: 'center', justifyContent: 'center',
  },
  hbTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: BLUE, lineHeight: 18, marginBottom: 3 },
  hbDesc: { fontFamily: 'Inter_400Regular', fontSize: 11, color: MUTED },

  // News cards
  newsCardWrap: {
    marginBottom: 10,
    shadowColor: 'rgba(8,21,143,0.1)', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1, shadowRadius: 10, elevation: 3,
  },
  newsCard: {
    backgroundColor: WHITE, borderRadius: 18,
    flexDirection: 'row', padding: 12,
  },
  newsThumbWrap: { position: 'relative' },
  newsThumb: { width: 90, height: 90, borderRadius: 14 },
  specialTag: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: GOLD, borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 2,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  specialTagText: { fontFamily: 'Inter_700Bold', fontSize: 7, color: BODY, letterSpacing: 0.3 },
  newsBody: { flex: 1, paddingLeft: 14, justifyContent: 'space-between' },
  newsTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: BODY, lineHeight: 20 },
  newsSnippet: { fontFamily: 'Inter_400Regular', fontSize: 12, color: MUTED, lineHeight: 17, marginTop: 4 },
  newsFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  newsMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: MUTED, marginLeft: 3 },
  newsRemoveBtn: {
    width: 26, height: 26, borderRadius: 8,
    backgroundColor: 'rgba(255,194,13,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  // Empty state
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: 'rgba(8,21,143,0.06)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, color: BLUE, marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyBtn: { backgroundColor: BLUE, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13 },
  emptyBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: WHITE },
});
