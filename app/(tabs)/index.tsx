import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useAuth } from "@/contexts/AuthContext";
import { useBookmarks } from "@/contexts/BookmarkContext";
import { isOnboardingSeen } from "@/utils/storage";
import HandbookService from "@/services/handbook_service";
import { Config } from "@/constants/config";
import type { HandbookSection } from "@/services/handbook_service";

// ─── Design tokens ────────────────────────────────────────────────

const BLUE   = "#08158F";
const BLUE2  = "#0A1DB8";
const BLUE3  = "#1833D6";
const GOLD   = "#FFC20D";
const BG     = "#F0F2F8";
const WHITE  = "#FFFFFF";
const BODY   = "#1A1A2E";
const MUTED  = "#6B7280";

const { width: SW } = Dimensions.get("window");
const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

const DEFAULT_COVER = require("@/assets/images/news_main.jpg");

interface NewsItem {
  id: number;
  title: string;
  cover_image_url: string | null;
  created_at: string;
}

function toUtc(iso: string) {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - toUtc(iso).getTime()) / 1000);
  if (diff < 60)    return "Яг одоо";
  if (diff < 3600)  return `${Math.floor(diff / 60)}м өмнө`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ц өмнө`;
  return toUtc(iso).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

function coverUri(item: NewsItem) {
  if (!item.cover_image_url) return DEFAULT_COVER;
  return {
    uri: item.cover_image_url.startsWith("http")
      ? item.cover_image_url
      : `${Config.API_BASE}${item.cover_image_url}`,
  };
}

// ─── Screen ────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const { bookmarks, isBookmarked, savedNews } = useBookmarks();

  const [news, setNews]             = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const heroOp = useRef(new Animated.Value(0)).current;
  const heroY  = useRef(new Animated.Value(-18)).current;
  const bodyOp = useRef(new Animated.Value(0)).current;
  const bodyY  = useRef(new Animated.Value(24)).current;

  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError(false);
    try {
      const r = await fetch(Config.NEWS);
      if (!r.ok) throw new Error(`News request failed: ${r.status}`);
      const d: NewsItem[] = await r.json();
      setNews(Array.isArray(d) ? d.slice(0, 5) : []);
      setNewsError(false);
    } catch {
      setNewsError(true);
    } finally {
      setNewsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heroOp, { toValue: 1, duration: 450, easing: EASE, useNativeDriver: true }),
      Animated.timing(heroY,  { toValue: 0, duration: 450, easing: EASE, useNativeDriver: true }),
      Animated.timing(bodyOp, { toValue: 1, duration: 520, delay: 140, easing: EASE, useNativeDriver: true }),
      Animated.timing(bodyY,  { toValue: 0, duration: 520, delay: 140, easing: EASE, useNativeDriver: true }),
    ]).start();
    fetchNews();
  }, []);

  if (!isOnboardingSeen()) return <Redirect href="/onboarding" />;
  if (!authLoading && !token) return <Redirect href="/login" />;

  const firstName = user?.full_name?.split(" ")[0] ?? "Оюутан";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Өглөөний мэнд" : hour < 17 ? "Өдрийн мэнд" : "Оройн мэнд";

  const bookmarkedSections = HandbookService.getAllSections()
    .filter((s) => isBookmarked(s.id))
    .slice(0, 6);
  const featuredSections = HandbookService.getAllSections().slice(0, 6);
  const totalSaved = bookmarkedSections.length + savedNews.size;

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* ── Hero header ──────────────────────────────────────────── */}
      <LinearGradient
        colors={[BLUE, BLUE2, BLUE3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.heroBg}
      >
        <View style={s.orbGold} />
        <View style={s.orbBlue} />
        <View style={s.orbTiny} />
        <SafeAreaView edges={["top"]}>
        <Animated.View style={[s.hero, { opacity: heroOp, transform: [{ translateY: heroY }] }]}>
          {/* Top row */}
          <View style={s.heroTopRow}>
            <Image
              source={require("@/assets/images/main_header.png")}
              style={s.logo}
              resizeMode="contain"
            />
            <View style={s.heroActions}>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/search" as any)}
                style={s.heroIconBtn}
                accessibilityLabel="Хадгалсан"
              >
                <MaterialIcons name="bookmark" size={19} color={WHITE} />
                {totalSaved > 0 && (
                  <View style={s.heroBadge}>
                    <Text style={s.heroBadgeText}>{totalSaved > 9 ? "9+" : totalSaved}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/profile" as any)}
                style={s.heroAvatarBtn}
              >
                <Text style={s.heroAvatarText}>
                  {(user?.full_name ?? "U").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Greeting */}
          <Text style={s.greetingLabel}>{greeting},</Text>
          <Text style={s.greetingName}>{firstName}</Text>
          {user?.student_id && (
            <View style={s.idRow}>
              <View style={s.idPill}>
                <MaterialIcons name="badge" size={12} color={GOLD} />
                <Text style={s.idText}>{user.student_id}</Text>
              </View>
              {user.department && (
                <Text style={s.deptText} numberOfLines={1}>{user.department}</Text>
              )}
            </View>
          )}
        </Animated.View>
        </SafeAreaView>
        <View style={s.heroCurve} />
      </LinearGradient>

      {/* ── Scrollable body ──────────────────────────────────────── */}
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.body}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchNews(); }}
            tintColor={BLUE}
            colors={[BLUE]}
          />
        }
      >
        <Animated.View style={{ opacity: bodyOp, transform: [{ translateY: bodyY }] }}>

          {/* ── Quick actions ───────────────────────────────────── */}
          <View style={s.quickGrid}>
            <QuickAction
              icon="auto-awesome"
              label="AI Туслах"
              gradient={["#7C3AED", "#9F67FF"]}
              onPress={() => router.push("/(tabs)/ai-assistant" as any)}
            />
            <QuickAction
              icon="menu-book"
              label="Гарын авлага"
              gradient={[BLUE, BLUE2]}
              onPress={() => router.push("/(tabs)/explore" as any)}
            />
            <QuickAction
              icon="campaign"
              label="Мэдээ"
              gradient={["#059669", "#34D399"]}
              onPress={() => router.push("/(tabs)/news" as any)}
            />
            <QuickAction
              icon="bookmark"
              label="Хадгалсан"
              gradient={["#D97706", "#FBBF24"]}
              onPress={() => router.push("/(tabs)/search" as any)}
            />
          </View>

          {/* ── Student stats strip ────────────────────────────── */}
          {user && <StatsStrip user={user} onPress={() => router.push("/(tabs)/profile" as any)} />}

          {/* ── Recent news ─────────────────────────────────────── */}
          {news.length > 0 ? (
            <>
              <SectionHeader
                title="Сүүлийн мэдээ"
                action={{ label: "Бүгд", onPress: () => router.push("/(tabs)/news" as any) }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.hScrollContent}
                style={s.hScroll}
              >
                {news.map((item, i) => (
                  <NewsCard
                    key={item.id}
                    item={item}
                    index={i}
                    onPress={() => router.push(`/news/${item.id}` as any)}
                  />
                ))}
              </ScrollView>
            </>
          ) : newsLoading ? (
            <>
              <SectionHeader
                title="Сүүлийн мэдээ"
                action={{ label: "Бүгд", onPress: () => router.push("/(tabs)/news" as any) }}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.hScrollContent}
                style={s.hScroll}
              >
                {[0, 1, 2].map((item) => (
                  <View key={item} style={s.newsSkeletonCard}>
                    <View style={s.newsSkeletonTitle} />
                    <View style={s.newsSkeletonLine} />
                  </View>
                ))}
              </ScrollView>
            </>
          ) : newsError ? (
            <>
              <SectionHeader
                title="Сүүлийн мэдээ"
                action={{ label: "Бүгд", onPress: () => router.push("/(tabs)/news" as any) }}
              />
              <NewsInlineState onRetry={fetchNews} />
            </>
          ) : null}

          {/* ── Bookmarks / featured chapters ──────────────────── */}
          <SectionHeader
            title={bookmarkedSections.length > 0 ? "Хадгалсан бүлгүүд" : "Онцлох бүлгүүд"}
            action={{
              label: "Бүгд",
              onPress: () => router.push(
                bookmarkedSections.length > 0 ? ("/(tabs)/search" as any) : ("/(tabs)/explore" as any)
              ),
            }}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.hScrollContent}
            style={s.hScroll}
          >
            {(bookmarkedSections.length > 0 ? bookmarkedSections : featuredSections).map((section, i) => (
              <ChapterCard
                key={section.id}
                section={section}
                index={i}
                onPress={() => router.push({ pathname: "/handbook/[slug]" as any, params: { slug: section.id } })}
              />
            ))}
          </ScrollView>

          {/* ── AI Banner ───────────────────────────────────────── */}
          <AIBanner onPress={() => router.push("/(tabs)/ai-assistant" as any)} />

        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── Section header ────────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.sectionActionBtn}>
          <Text style={s.sectionAction}>{action.label}</Text>
          <MaterialIcons name="arrow-forward" size={13} color={BLUE} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function NewsInlineState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={s.newsStateCard}>
      <View style={s.newsStateIcon}>
        <MaterialIcons name="cloud-off" size={20} color={BLUE} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.newsStateTitle}>Мэдээ түр ачаалсангүй</Text>
        <Text style={s.newsStateText}>Интернэт эсвэл серверийн холболтоо шалгаад дахин оролдоно уу.</Text>
      </View>
      <TouchableOpacity onPress={onRetry} style={s.newsRetryBtn} activeOpacity={0.8}>
        <MaterialIcons name="refresh" size={16} color={BLUE} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Quick action tile ─────────────────────────────────────────────

function QuickAction({ icon, label, gradient, onPress }: {
  icon: string; label: string; gradient: [string, string]; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[s.quickItem, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }).start()}
        style={s.quickBtn}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.quickGradient}
        >
          <MaterialIcons name={icon as any} size={24} color={WHITE} />
        </LinearGradient>
        <Text style={s.quickLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Stats strip ───────────────────────────────────────────────────

function StatsStrip({ user, onPress }: { user: any; onPress: () => void }) {
  const items = [
    { label: "Голч", value: user.gpa != null ? user.gpa.toFixed(2) : "—", icon: "grade" as const, color: GOLD },
    { label: "Кредит", value: user.total_credits != null ? String(user.total_credits) : "—", icon: "menu-book" as const, color: BLUE },
    { label: "Элссэн", value: user.admission_year ? `20${user.admission_year}` : "—", icon: "calendar-today" as const, color: "#059669" },
  ];

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={s.statsCard}>
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          <View style={s.statItem}>
            <View style={[s.statIconWrap, { backgroundColor: item.color + "14" }]}>
              <MaterialIcons name={item.icon} size={16} color={item.color} />
            </View>
            <Text style={s.statValue}>{item.value}</Text>
            <Text style={s.statLabel}>{item.label}</Text>
          </View>
          {i < items.length - 1 && <View style={s.statDivider} />}
        </React.Fragment>
      ))}
    </TouchableOpacity>
  );
}

// ─── News card (horizontal) ────────────────────────────────────────

function NewsCard({ item, index, onPress }: { item: NewsItem; index: number; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const op    = useRef(new Animated.Value(0)).current;
  const x     = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 350, delay: index * 60, easing: EASE, useNativeDriver: true }),
      Animated.timing(x,  { toValue: 0, duration: 350, delay: index * 60, easing: EASE, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.newsCardWrap, { opacity: op, transform: [{ translateX: x }, { scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }).start()}
      >
        <Image source={coverUri(item)} style={s.newsImg} resizeMode="cover" />
        <LinearGradient
          colors={["transparent", "rgba(8,12,80,0.85)"]}
          locations={[0.3, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={s.newsContent}>
          <Text style={s.newsTitle} numberOfLines={2}>{item.title}</Text>
          <View style={s.newsTimePill}>
            <MaterialIcons name="access-time" size={10} color="rgba(255,255,255,0.7)" />
            <Text style={s.newsTime}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Chapter card (horizontal) ────────────────────────────────────

function ChapterCard({ section, index, onPress }: {
  section: HandbookSection; index: number; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const op    = useRef(new Animated.Value(0)).current;
  const x     = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 320, delay: index * 50, easing: EASE, useNativeDriver: true }),
      Animated.timing(x,  { toValue: 0, duration: 320, delay: index * 50, easing: EASE, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.chapterWrap, { opacity: op, transform: [{ translateX: x }, { scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }).start()}
        style={s.chapterCard}
      >
        <View style={s.chapterIconWrap}>
          <MaterialIcons name={section.icon as any} size={22} color={BLUE} />
        </View>
        <Text style={s.chapterTitle} numberOfLines={2}>{section.title}</Text>
        <Text style={s.chapterDesc} numberOfLines={1}>{section.description}</Text>
        <View style={s.chapterArrow}>
          <MaterialIcons name="arrow-forward" size={12} color={BLUE} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── AI Banner ─────────────────────────────────────────────────────

function AIBanner({ onPress }: { onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={{ transform: [{ scale }], marginTop: 24, marginBottom: 8 }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }).start()}
      >
        <LinearGradient
          colors={[BLUE, "#1a2dd4"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.aiBanner}
        >
          {/* Decorative circles */}
          <View style={s.aiDecor1} />
          <View style={s.aiDecor2} />

          <View style={s.aiRow}>
            <View style={s.aiIconWrap}>
              <MaterialIcons name="auto-awesome" size={26} color={GOLD} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.aiTitleRow}>
                <Text style={s.aiTitle}>AI Туслах</Text>
                <View style={s.betaBadge}><Text style={s.betaText}>BETA</Text></View>
              </View>
              <Text style={s.aiDesc}>Гарын авлагаас AI-аар хариулт авах</Text>
            </View>
            <View style={s.aiChevron}>
              <MaterialIcons name="arrow-forward" size={18} color={WHITE} />
            </View>
          </View>

          {/* Quick prompts */}
          <View style={s.aiPrompts}>
            <View style={s.aiPromptChip}>
              <Text style={s.aiPromptText}>Тэтгэлэг</Text>
            </View>
            <View style={s.aiPromptChip}>
              <Text style={s.aiPromptText}>Элсэлт</Text>
            </View>
            <View style={s.aiPromptChip}>
              <Text style={s.aiPromptText}>Кредит</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Hero
  heroBg: { overflow: "hidden" },
  orbGold: {
    position: "absolute",
    top: -60, right: -50,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: GOLD, opacity: 0.12,
  },
  orbBlue: {
    position: "absolute",
    top: 40, left: -80,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: "#FFFFFF", opacity: 0.05,
  },
  orbTiny: {
    position: "absolute",
    top: 90, right: 60,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: GOLD, opacity: 0.8,
  },
  hero: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22 },
  heroTopRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 22,
  },
  logo: { width: 180, height: 34 },
  heroActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroIconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  heroBadge: {
    position: "absolute", top: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: GOLD, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: BLUE,
  },
  heroBadgeText: { fontFamily: "Inter_700Bold", fontSize: 9, color: BODY },
  heroAvatarBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(255,194,13,0.2)",
    borderWidth: 1, borderColor: "rgba(255,194,13,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  heroAvatarText: { fontFamily: "Inter_700Bold", fontSize: 13, color: GOLD },

  greetingLabel: {
    fontFamily: "Inter_400Regular", fontSize: 14,
    color: "rgba(255,255,255,0.6)", marginBottom: 2,
  },
  greetingName: {
    fontFamily: "Inter_700Bold", fontSize: 28,
    color: WHITE, letterSpacing: -0.5,
  },
  idRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  idPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,194,13,0.15)",
    borderWidth: 1, borderColor: "rgba(255,194,13,0.3)",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
  },
  idText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: GOLD, letterSpacing: 0.8 },
  deptText: {
    fontFamily: "Inter_400Regular", fontSize: 12,
    color: "rgba(255,255,255,0.5)", flex: 1,
  },
  heroCurve: {
    height: 40, backgroundColor: BG,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -12,
  },

  body: { paddingHorizontal: 16, paddingBottom: 120 },

  // Section header
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14, marginTop: 24,
  },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: BODY, letterSpacing: -0.3 },
  sectionActionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  sectionAction: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: BLUE },

  // Quick actions
  quickGrid: { flexDirection: "row", gap: 10, marginTop: 4 },
  quickItem: { flex: 1 },
  quickBtn: {
    alignItems: "center", backgroundColor: WHITE, borderRadius: 18,
    paddingVertical: 18, paddingHorizontal: 4,
    shadowColor: "rgba(8,21,143,0.08)", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 3,
  },
  quickGradient: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  quickLabel: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: BODY, textAlign: "center" },

  // Stats strip
  statsCard: {
    flexDirection: "row", backgroundColor: WHITE, borderRadius: 18,
    padding: 16, marginTop: 18, alignItems: "center",
    shadowColor: "rgba(8,21,143,0.08)", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 3,
  },
  statItem: { flex: 1, alignItems: "center" },
  statIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: BODY, letterSpacing: -0.5 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: MUTED, marginTop: 2 },
  statDivider: { width: 1, height: 40, backgroundColor: "rgba(8,21,143,0.06)" },

  // Horizontal scroll
  hScroll: { marginHorizontal: -16, paddingHorizontal: 0 },
  hScrollContent: { gap: 12, paddingHorizontal: 16, paddingRight: 16 },

  // News card
  newsCardWrap: {
    width: 200, height: 140, borderRadius: 18, overflow: "hidden",
    shadowColor: "rgba(8,21,143,0.15)", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 4,
  },
  newsImg: { width: "100%", height: "100%" },
  newsContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12 },
  newsTitle: {
    fontFamily: "Inter_600SemiBold", fontSize: 13, color: WHITE,
    lineHeight: 18, marginBottom: 6,
  },
  newsTimePill: { flexDirection: "row", alignItems: "center", gap: 4 },
  newsTime: { fontFamily: "Inter_400Regular", fontSize: 10, color: "rgba(255,255,255,0.7)" },
  newsSkeletonCard: {
    width: 200,
    height: 140,
    borderRadius: 18,
    backgroundColor: WHITE,
    padding: 14,
    justifyContent: "flex-end",
    shadowColor: "rgba(8,21,143,0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  newsSkeletonTitle: {
    width: "82%",
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(8,21,143,0.08)",
    marginBottom: 8,
  },
  newsSkeletonLine: {
    width: "48%",
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(8,21,143,0.06)",
  },
  newsStateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(8,21,143,0.07)",
    shadowColor: "rgba(8,21,143,0.08)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  newsStateIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(8,21,143,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  newsStateTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: BODY,
    marginBottom: 2,
  },
  newsStateText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 16,
    color: MUTED,
  },
  newsRetryBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "rgba(8,21,143,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Chapter card
  chapterWrap: { width: 140 },
  chapterCard: {
    backgroundColor: WHITE, borderRadius: 18, padding: 16,
    minHeight: 150,
    shadowColor: "rgba(8,21,143,0.08)", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1, shadowRadius: 10, elevation: 2,
  },
  chapterIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "rgba(8,21,143,0.07)",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  chapterTitle: {
    fontFamily: "Inter_600SemiBold", fontSize: 13, color: BODY,
    lineHeight: 18, marginBottom: 4,
  },
  chapterDesc: { fontFamily: "Inter_400Regular", fontSize: 10, color: MUTED, marginBottom: 8 },
  chapterArrow: {
    width: 24, height: 24, borderRadius: 8,
    backgroundColor: "rgba(8,21,143,0.06)",
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-end", marginTop: "auto",
  },

  // AI Banner
  aiBanner: {
    borderRadius: 22, padding: 20, overflow: "hidden",
    shadowColor: "rgba(8,21,143,0.35)", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1, shadowRadius: 20, elevation: 8,
  },
  aiDecor1: {
    position: "absolute", top: -30, right: -30,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(255,194,13,0.08)",
  },
  aiDecor2: {
    position: "absolute", bottom: -20, left: -20,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  aiRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  aiIconWrap: {
    width: 50, height: 50, borderRadius: 16,
    backgroundColor: "rgba(255,194,13,0.15)",
    borderWidth: 1, borderColor: "rgba(255,194,13,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  aiTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  aiTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: WHITE },
  aiDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: "rgba(255,255,255,0.6)" },
  betaBadge: { backgroundColor: GOLD, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  betaText: { fontFamily: "Inter_700Bold", fontSize: 9, color: BODY, letterSpacing: 0.5 },
  aiChevron: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  aiPrompts: { flexDirection: "row", gap: 8, marginTop: 14 },
  aiPromptChip: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  aiPromptText: { fontFamily: "Inter_500Medium", fontSize: 11, color: "rgba(255,255,255,0.75)" },
});
