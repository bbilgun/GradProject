import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Keyboard,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient"; // still used in special cards
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { Config } from "@/constants/config";
import { useBookmarks } from "@/contexts/BookmarkContext";

const { width: SW } = Dimensions.get("window");

interface NewsItem {
  id: number;
  title: string;
  cover_image_url: string | null;
  is_special: boolean;
  content: string | null;
  sections: { body: string }[];
  author_name: string | null;
  created_at: string;
}

const BLUE = "#08158F";
const BLUE2 = "#0A1DB8";
const BLUE3 = "#1833D6";
const GOLD = "#FFC20D";
const GOLD2 = "#FFD84D";
const BG = "#F0F2F8";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const BODY = "#1A1A2E";
const CARD = "#FFFFFF";

const EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const DEFAULT_COVER = require("@/assets/images/news_main.jpg");

function coverSource(item: NewsItem) {
  if (!item.cover_image_url) return DEFAULT_COVER;
  return {
    uri: item.cover_image_url.startsWith("http")
      ? item.cover_image_url
      : `${Config.API_BASE}${item.cover_image_url}`,
  };
}

function toUtc(iso: string) {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - toUtc(iso).getTime()) / 1000);
  if (diff < 60) return "Яг одоо";
  if (diff < 3600) return `${Math.floor(diff / 60)}м өмнө`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ц өмнө`;
  return toUtc(iso).toLocaleDateString("mn-MN", {
    month: "short",
    day: "numeric",
  });
}

// ─── Screen ─────────────────────────────────────────────────────────

export default function NewsScreen() {
  const router = useRouter();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headerOp = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOp, {
        toValue: 1,
        duration: 500,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(headerY, {
        toValue: 0,
        duration: 500,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fetchNews = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch(Config.NEWS);
      if (!res.ok) throw new Error("Серверт алдаа гарлаа.");
      setNews(await res.json());
    } catch (e: any) {
      setError(e.message ?? "Мэдээ ачааллахад алдаа гарлаа.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, []);

  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const isSearching = query.trim().length > 0;

  const norm = (s: string | null | undefined) => (s ?? "").toLowerCase();
  const matches = useMemo(() => {
    if (!isSearching) return news;
    const q = query.trim().toLowerCase();
    return news.filter((n) => {
      if (norm(n.title).includes(q)) return true;
      if (norm(n.content).includes(q)) return true;
      if (norm(n.author_name).includes(q)) return true;
      if (n.sections?.some((sec) => norm(sec.body).includes(q))) return true;
      return false;
    });
  }, [news, query, isSearching]);

  const specialNews = isSearching ? [] : matches.filter((n) => n.is_special);
  const regularNews = isSearching
    ? matches
    : matches.filter((n) => !n.is_special);
  const [activeCarousel, setActiveCarousel] = useState(0);

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* ── Header ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={[BLUE, BLUE2, BLUE3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        <View style={s.orbGold} />
        <View style={s.orbBlue} />
        <View style={s.orbTiny} />
        <SafeAreaView edges={["top"]}>
          <Animated.View
            style={[
              s.header,
              { opacity: headerOp, transform: [{ translateY: headerY }] },
            ]}
          >
            <View style={s.headerLeft}>
              <Image
                source={require("@/assets/images/main_logo.png")}
                style={s.headerLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={s.headerTitle}>Мэдээ мэдээлэл</Text>
                <Text style={s.headerSub}>Оюутны зөвлөлийн мэдээнүүд</Text>
              </View>
            </View>
            {news.length > 0 && (
              <View style={s.countPill}>
                <Text style={s.countText}>{news.length} мэдээ</Text>
              </View>
            )}
          </Animated.View>
        </SafeAreaView>
        <View style={s.headerCurve} />
      </LinearGradient>

      {/* ── Search bar ─────────────────────────────────────────── */}
      <View style={s.searchWrap}>
        <View style={[s.searchPill, focused && s.searchPillFocused]}>
          <MaterialIcons
            name="search"
            size={18}
            color={focused ? BLUE : MUTED}
          />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Мэдээ хайх..."
            placeholderTextColor={MUTED}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            style={s.searchInput}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="close" size={17} color={MUTED} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Loading ────────────────────────────────────────────── */}
      {loading && <SkeletonList hasSpecial />}

      {/* ── Error ──────────────────────────────────────────────── */}
      {!loading && error && (
        <View style={s.center}>
          <View style={s.errorIconWrap}>
            <MaterialIcons name="wifi-off" size={28} color={MUTED} />
          </View>
          <Text style={s.errorTitle}>Холболт тасарлаа</Text>
          <Text style={s.errorBody}>{error}</Text>
          <TouchableOpacity onPress={() => fetchNews()} style={s.retryBtn}>
            <MaterialIcons name="refresh" size={15} color={WHITE} />
            <Text style={s.retryText}>Дахин оролдох</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Content ────────────────────────────────────────────── */}
      {!loading && !error && (
        <FlatList
          data={regularNews}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchNews(true);
              }}
              tintColor={BLUE}
              colors={[BLUE]}
            />
          }
          ListHeaderComponent={
            <>
              {/* Special news carousel */}
              {specialNews.length > 0 && (
                <View style={s.specialSection}>
                  <View style={s.sectionHeader}>
                    <View style={s.sectionBadge}>
                      <MaterialIcons name="star" size={13} color={GOLD} />
                      <Text style={s.sectionBadgeText}>ОНЦЛОХ МЭДЭЭ</Text>
                    </View>
                    <Text style={s.sectionCount}>
                      {specialNews.length} мэдээ
                    </Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.carouselContent}
                    decelerationRate="fast"
                    snapToInterval={SW - 48 + 12}
                    snapToAlignment="start"
                    onScroll={(e) => {
                      const idx = Math.round(
                        e.nativeEvent.contentOffset.x / (SW - 48 + 12),
                      );
                      setActiveCarousel(idx);
                    }}
                    scrollEventThrottle={16}
                  >
                    {specialNews.map((item, i) => (
                      <SpecialCard
                        key={item.id}
                        item={item}
                        index={i}
                        isLast={i === specialNews.length - 1}
                        onPress={() => router.push(`/news/${item.id}` as any)}
                      />
                    ))}
                  </ScrollView>
                  {specialNews.length > 1 && (
                    <View style={s.dotRow}>
                      {specialNews.map((_, i) => (
                        <View
                          key={i}
                          style={[s.dot, i === activeCarousel && s.dotActive]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Regular news section header */}
              {regularNews.length > 0 && (
                <View style={s.sectionHeader2}>
                  <View style={s.sectionLine} />
                  <Text style={s.sectionLabel}>
                    {isSearching
                      ? `ҮР ДҮН · ${regularNews.length}`
                      : "БҮХ МЭДЭЭ"}
                  </Text>
                  <View style={s.sectionLine} />
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            specialNews.length === 0 ? (
              <View style={s.emptyWrap}>
                <View style={s.emptyIconWrap}>
                  <MaterialIcons
                    name="newspaper"
                    size={36}
                    color="rgba(8,21,143,0.18)"
                  />
                </View>
                <Text style={s.emptyTitle}>Мэдээ байхгүй байна</Text>
                <Text style={s.emptyBody}>
                  Удахгүй шинэ мэдээ нийтлэгдэх болно
                </Text>
                <TouchableOpacity
                  onPress={() => fetchNews()}
                  style={s.retryBtn}
                >
                  <MaterialIcons name="refresh" size={15} color={WHITE} />
                  <Text style={s.retryText}>Дахин ачаалах</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item, index }) => (
            <RegularCard
              item={item}
              index={index}
              onPress={() => router.push(`/news/${item.id}` as any)}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Special card (carousel) ─────────────────────────────────────────

function SpecialCard({
  item,
  index,
  isLast,
  onPress,
}: {
  item: NewsItem;
  index: number;
  isLast: boolean;
  onPress: () => void;
}) {
  const { toggleNews, isNewsSaved } = useBookmarks();
  const saved = isNewsSaved(item.id);
  const scale = useRef(new Animated.Value(1)).current;
  const op = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(24)).current;
  const isNew = Date.now() - toUtc(item.created_at).getTime() < 86_400_000 * 2;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(x, {
        toValue: 0,
        duration: 400,
        delay: index * 80,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        s.specialCardWrap,
        isLast && { marginRight: 0 },
        { opacity: op, transform: [{ translateX: x }, { scale }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 4,
          }).start()
        }
      >
        {/* Image */}
        <Image
          source={coverSource(item)}
          style={s.specialImg}
          resizeMode="cover"
        />

        {/* Gradient overlay */}
        <LinearGradient
          colors={["transparent", "rgba(8,12,80,0.55)", "rgba(8,12,80,0.92)"]}
          locations={[0.35, 0.65, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Top badges */}
        <View style={s.specialTopRow}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flex: 1,
            }}
          >
            <View style={s.specialBadge}>
              <MaterialIcons name="star" size={10} color={BODY} />
              <Text style={s.specialBadgeText}>ОНЦЛОХ</Text>
            </View>
            {isNew && (
              <View style={s.newBadge}>
                <Text style={s.newBadgeText}>ШИНЭ</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={() => toggleNews(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.saveBtn}
          >
            <MaterialIcons
              name={saved ? "bookmark" : "bookmark-border"}
              size={18}
              color={saved ? GOLD : WHITE}
            />
          </TouchableOpacity>
        </View>

        {/* Bottom content */}
        <View style={s.specialBottom}>
          <Text style={s.specialTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={s.specialMeta}>
            <View style={s.metaRow}>
              <MaterialIcons
                name="person-outline"
                size={11}
                color="rgba(255,255,255,0.65)"
              />
              <Text style={s.metaTextLight}>
                {item.author_name ?? "Оюутны зөвлөл"}
              </Text>
            </View>
            <View style={s.metaDot} />
            <View style={s.metaRow}>
              <MaterialIcons
                name="access-time"
                size={11}
                color="rgba(255,255,255,0.65)"
              />
              <Text style={s.metaTextLight}>{timeAgo(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Regular card ─────────────────────────────────────────────────────

function RegularCard({
  item,
  index,
  onPress,
}: {
  item: NewsItem;
  index: number;
  onPress: () => void;
}) {
  const { toggleNews, isNewsSaved } = useBookmarks();
  const saved = isNewsSaved(item.id);
  const scale = useRef(new Animated.Value(1)).current;
  const op = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(14)).current;
  const isNew = Date.now() - toUtc(item.created_at).getTime() < 86_400_000 * 2;
  const snippet = item.sections[0]?.body ?? item.content ?? "";

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, {
        toValue: 1,
        duration: 350,
        delay: index * 55,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 350,
        delay: index * 55,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        s.regularCardWrap,
        { opacity: op, transform: [{ translateY: y }, { scale }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={1}
        style={s.regularCard}
        onPress={onPress}
        onPressIn={() =>
          Animated.spring(scale, {
            toValue: 0.97,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            friction: 4,
          }).start()
        }
      >
        {/* Thumbnail */}
        <View style={s.thumbWrap}>
          <Image
            source={coverSource(item)}
            style={s.thumb}
            resizeMode="cover"
          />
          {isNew && (
            <View style={s.thumbNewBadge}>
              <Text style={s.thumbNewText}>ШИНЭ</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={s.regularBody}>
          <Text style={s.regularTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {!!snippet && (
            <Text style={s.regularSnippet} numberOfLines={2}>
              {snippet}
            </Text>
          )}
          <View style={s.regularFooter}>
            <View style={s.metaRow}>
              <MaterialIcons name="access-time" size={11} color={MUTED} />
              <Text style={s.regularMeta}>{timeAgo(item.created_at)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => toggleNews(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={s.chevronWrap}
            >
              <MaterialIcons
                name={saved ? "bookmark" : "bookmark-border"}
                size={16}
                color={saved ? GOLD : BLUE}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────

function SkeletonList({ hasSpecial }: { hasSpecial?: boolean }) {
  const op = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, {
          toValue: 0.85,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue: 0.35,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View style={{ opacity: op }}>
      {/* Special skeleton */}
      <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
        <View
          style={{
            height: 16,
            width: 120,
            borderRadius: 8,
            backgroundColor: WHITE,
            marginBottom: 14,
          }}
        />
        <View
          style={{ height: 220, borderRadius: 20, backgroundColor: WHITE }}
        />
      </View>
      {/* Regular skeletons */}
      <View style={{ paddingHorizontal: 16, paddingTop: 20, gap: 10 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[s.regularCard, { gap: 0 }]}>
            <View
              style={[s.thumb, { backgroundColor: BG, borderRadius: 14 }]}
            />
            <View style={{ flex: 1, gap: 9, paddingLeft: 14 }}>
              <View
                style={{
                  height: 13,
                  borderRadius: 7,
                  backgroundColor: BG,
                  width: "88%",
                }}
              />
              <View
                style={{
                  height: 13,
                  borderRadius: 7,
                  backgroundColor: BG,
                  width: "65%",
                }}
              />
              <View
                style={{
                  height: 10,
                  borderRadius: 7,
                  backgroundColor: BG,
                  width: "40%",
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },

  // Hero
  hero: { paddingBottom: 38, overflow: "hidden" },
  orbGold: {
    position: "absolute",
    top: -60,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: GOLD,
    opacity: 0.12,
  },
  orbBlue: {
    position: "absolute",
    top: 40,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#FFFFFF",
    opacity: 0.05,
  },
  orbTiny: {
    position: "absolute",
    top: 90,
    right: 60,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GOLD,
    opacity: 0.8,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogo: { width: 36, height: 36, borderRadius: 8 },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 19,
    color: WHITE,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    marginTop: 1,
  },
  headerCurve: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: BG,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  countPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  countText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
  },

  // Search bar
  searchWrap: {
    backgroundColor: BG,
    paddingHorizontal: 16,
    marginTop: -16,
    paddingTop: 0,
    paddingBottom: 8,
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  searchPillFocused: { borderColor: BLUE, backgroundColor: WHITE },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    paddingVertical: 0,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: BODY,
  },

  listContent: { paddingBottom: 110 },

  // Special section
  specialSection: { paddingTop: 4, paddingBottom: 6 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  sectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,194,13,0.12)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,194,13,0.3)",
  },
  sectionBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#B8820A",
    letterSpacing: 0.6,
  },
  sectionCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: MUTED },
  carouselContent: { paddingHorizontal: 16, gap: 12 },

  // Special card
  specialCardWrap: {
    width: SW - 48,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
    marginRight: 12,
  },
  specialImg: { width: "100%", height: 220 },
  specialTopRow: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  saveBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  specialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: GOLD,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  specialBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: BODY,
    letterSpacing: 0.7,
  },
  newBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  newBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: WHITE,
    letterSpacing: 0.6,
  },
  specialBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingTop: 10,
  },
  specialTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: WHITE,
    lineHeight: 23,
    marginBottom: 8,
  },
  specialMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },

  // Carousel dots
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    paddingTop: 12,
    paddingBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(8,21,143,0.18)",
  },
  dotActive: { width: 18, backgroundColor: BLUE },

  // Section divider
  sectionHeader2: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: "rgba(8,21,143,0.08)" },
  sectionLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    color: MUTED,
    letterSpacing: 1.2,
  },

  // Regular card
  regularCardWrap: {
    shadowColor: "rgba(8,21,143,0.1)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
    marginHorizontal: 16,
  },
  regularCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    flexDirection: "row",
    padding: 12,
    gap: 0,
  },
  thumbWrap: { position: "relative" },
  thumb: { width: 90, height: 90, borderRadius: 14 },
  thumbNewBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: GOLD,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  thumbNewText: {
    fontFamily: "Inter_700Bold",
    fontSize: 8,
    color: BODY,
    letterSpacing: 0.4,
  },
  regularBody: { flex: 1, paddingLeft: 14, justifyContent: "space-between" },
  regularTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: BODY,
    lineHeight: 20,
  },
  regularSnippet: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: MUTED,
    lineHeight: 17,
    marginTop: 4,
  },
  regularFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  regularMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: MUTED,
    marginLeft: 3,
  },
  chevronWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "rgba(8,21,143,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Meta row
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaTextLight: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.7)",
  },

  // Empty state
  emptyWrap: { alignItems: "center", paddingTop: 48, paddingBottom: 32 },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "rgba(8,21,143,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: BODY,
    marginBottom: 6,
  },
  emptyBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
  },

  // Error
  errorIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(8,21,143,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: BODY,
    marginBottom: 6,
  },
  errorBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    marginBottom: 24,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: BLUE,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: WHITE },
});
