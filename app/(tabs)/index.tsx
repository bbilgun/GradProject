import React, { useRef, useEffect, useState, useMemo } from "react";
import { Redirect } from "expo-router";
import { isOnboardingSeen } from "@/utils/storage";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import HandbookService from "@/services/handbook_service";
import { useBookmarks } from "@/contexts/BookmarkContext";
import { EaseOutExpo, Space } from "@/constants/Theme";
import { Config } from "@/constants/config";
import type { HandbookSection } from "@/services/handbook_service";

// ─── RAG search result type ───────────────────────────────────────

interface SearchResult {
  section: HandbookSection;
  snippet: string;
}

// ─── Design tokens ────────────────────────────────────────────────

const BLUE = "#08158F";
const GOLD = "#FFC20D";
const BG = "#F8F9FA";
const WHITE = "#FFFFFF";
const BODY = "#1A1A2E";
const MUTED = "#6B7280";
const BORDER = "rgba(8,21,143,0.09)";

const EASE = Easing.bezier(...EaseOutExpo);

// ─── Category mapping ─────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  introduction: "general",
  "student-life": "general",
  schools: "schools",
  "core-curriculum": "schools",
  "credit-system": "schools",
  admission: "schools",
  "digital-learning": "schools",
  graduation: "schools",
  "exchange-programs": "schools",
  scholarships: "rules",
  dormitory: "other",
  "health-services": "other",
  research: "other",
  "international-students": "other",
};

const TABS = [
  { id: "all", label: "Бүгд" },
  { id: "general", label: "Ерөнхий" },
  { id: "schools", label: "Сургууль" },
  { id: "rules", label: "Дүрэм журам" },
  { id: "other", label: "Бусад" },
];

const ALL_SECTIONS = HandbookService.getAllSections();

interface QuickLink {
  id: string;
  title: string;
  url: string;
  category: string;
}

// ─── Screen ───────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { toggle, isBookmarked } = useBookmarks();

  // Synchronous onboarding gate — no async, no blank screen
  // DEV: always show onboarding. For prod: change `!isOnboardingSeen()` stays as-is,
  // just make sure markOnboardingSeen() is called on completion.
  if (!isOnboardingSeen()) return <Redirect href="/onboarding" />;

  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    Keyboard.dismiss();
    setSearching(true);
    setSearchResults([]);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(Config.SEARCH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, top_k: 8 }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      const data = await res.json();
      const mapped: SearchResult[] = (data.results ?? []).map((r: any) => {
        const section = HandbookService.getSectionBySlug(r.section_id) ?? {
          id: r.section_id,
          title: r.section_title ?? r.section_id,
          titleEn: "",
          description: "",
          icon: "article",
          color: "#EFF6FF",
          darkColor: "#1E3A5F",
          content: "",
        };
        return { section, snippet: r.text ?? "" };
      });
      setSearchResults(mapped);
    } catch {
      const offline = HandbookService.searchLocal(q);
      setSearchResults(
        offline.map((s) => ({ section: s, snippet: s.description })),
      );
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
  };

  // Fetch recent documents
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch(Config.RESOURCES_RECENT_ENDPOINT, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setQuickLinks(d.items ?? []))
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }, []);

  // ── Filtered sections ──────────────────────────────────────────
  const filteredSections = useMemo(() => {
    let list = ALL_SECTIONS;
    if (activeTab !== "all") {
      list = list.filter((s) => CATEGORY_MAP[s.id] === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [activeTab, searchQuery]);

  // Build rows of 2 for the grid
  const rows = useMemo(() => {
    const r: HandbookSection[][] = [];
    for (let i = 0; i < filteredSections.length; i += 2) {
      r.push(filteredSections.slice(i, i + 2));
    }
    return r;
  }, [filteredSections]);

  // Header entrance animation
  const headerOp = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOp, {
        toValue: 1,
        duration: 380,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(headerY, {
        toValue: 0,
        duration: 380,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const goToChapter = (section: HandbookSection) =>
    router.push({
      pathname: "/handbook/[slug]" as any,
      params: { slug: section.id },
    });

  const activeCategoryLabel =
    TABS.find((t) => t.id === activeTab)?.label ?? "Бүгд";

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      {/* ── Blue header ─────────────────────────────────────── */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: BLUE }}>
        <Animated.View
          style={{
            opacity: headerOp,
            transform: [{ translateY: headerY }],
            paddingHorizontal: 20,
            paddingTop: 10,
            paddingBottom: 24,
          }}
        >
          {/* Top row: logo + AI button */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <Image
              source={require("@/assets/images/main_logo.png")}
              style={{ width: 36, height: 36, borderRadius: 8 }}
              resizeMode="contain"
            />
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/ai-assistant" as any)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.13)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="auto-awesome" size={19} color={GOLD} />
            </TouchableOpacity>
          </View>
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 26,
              color: WHITE,
              letterSpacing: -0.5,
              marginBottom: 4,
            }}
          >
            ШУТИС Гарын Авлага
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 12,
              color: "rgba(255,255,255,0.60)",
            }}
          >
            Оюутны бүх мэдээлэл нэг дороос
          </Text>
        </Animated.View>
        {/* Rounded bottom edge */}
        <View
          style={{
            height: 22,
            backgroundColor: BG,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            marginTop: -1,
          }}
        />
      </SafeAreaView>

      {/* ── Sticky search + category bar ────────────────────── */}
      <View
        style={{
          backgroundColor: WHITE,

          zIndex: 10,
        }}
      >
        {/* Search input */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginHorizontal: Space.gutter,
            marginTop: 12,
            marginBottom: 10,
            backgroundColor: BG,
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1.5,
            borderColor: searchFocused ? BLUE : "transparent",
          }}
        >
          <MaterialIcons
            name="search"
            size={18}
            color={searchFocused ? BLUE : MUTED}
          />
          <TextInput
            placeholder="Хайлт хийх..."
            placeholderTextColor={MUTED}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (!text) setSearchResults(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="search"
            onSubmitEditing={() => doSearch(searchQuery)}
            style={{
              flex: 1,
              marginLeft: 10,
              paddingVertical: 0,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: BODY,
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons name="close" size={17} color={MUTED} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: Space.gutter,
            paddingBottom: 12,
            gap: 8,
          }}
        >
          {TABS.map((tab) => (
            <CategoryChip
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onPress={setActiveTab}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Search results view ──────────────────────────────── */}
      {searchResults !== null && (
        <View style={{ flex: 1 }}>
          {/* Results header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: Space.gutter,
              paddingVertical: 12,
              backgroundColor: WHITE,
              borderBottomWidth: 1,
              borderBottomColor: BORDER,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
                color: MUTED,
                flex: 1,
              }}
            >
              {searching
                ? "Хайж байна..."
                : `${searchResults.length} үр дүн — "${searchQuery}"`}
            </Text>
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  color: BLUE,
                }}
              >
                Буцах
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: Space.gutter,
              paddingBottom: 110,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {searching && [1, 2, 3, 4].map((i) => <SearchSkeleton key={i} />)}

            {!searching && searchResults.length === 0 && (
              <View style={{ alignItems: "center", paddingVertical: 48 }}>
                <MaterialIcons
                  name="search-off"
                  size={42}
                  color={MUTED}
                  style={{ marginBottom: 12 }}
                />
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 14,
                    color: MUTED,
                  }}
                >
                  Үр дүн олдсонгүй
                </Text>
              </View>
            )}

            {!searching &&
              searchResults.map((r, idx) => (
                <SearchResultCard
                  key={`${r.section.id}-${idx}`}
                  result={r}
                  onPress={() =>
                    router.push({
                      pathname: "/handbook/[slug]" as any,
                      params: { slug: r.section.id },
                    })
                  }
                />
              ))}
          </ScrollView>
        </View>
      )}

      {/* ── Normal scrollable content ────────────────────────── */}
      {searchResults === null && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: Space.gutter, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* AI Assistant banner */}
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/ai-assistant" as any)}
            activeOpacity={0.88}
            style={{
              backgroundColor: WHITE,
              borderRadius: 16,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1.5,
              borderColor: GOLD,
              marginBottom: 20,
              shadowColor: "rgba(255,194,13,0.25)",
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 1,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: "rgba(255,194,13,0.10)",
                borderWidth: 1,
                borderColor: "rgba(255,194,13,0.25)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <MaterialIcons name="auto-awesome" size={22} color={GOLD} />
            </View>
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 3,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 14,
                    color: BLUE,
                  }}
                >
                  AI Туслах
                </Text>
                <View
                  style={{
                    marginLeft: 7,
                    backgroundColor: GOLD,
                    borderRadius: 5,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 9,
                      color: BODY,
                      letterSpacing: 0.5,
                    }}
                  >
                    BETA
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  color: MUTED,
                }}
              >
                Гарын авлагаас AI-аар хайлт хийх, тайлбар авах
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={22}
              color="rgba(8,21,143,0.25)"
            />
          </TouchableOpacity>

          {/* Recent documents strip */}
          {quickLinks.length > 0 && (
            <View style={{ marginBottom: 22 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 15,
                    color: BLUE,
                    letterSpacing: -0.2,
                  }}
                >
                  Сүүлийн баримтууд
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(tabs)/explore" as any)}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                      color: GOLD,
                    }}
                  >
                    Бүгдийг харах →
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
              >
                {quickLinks.map((item, idx) => (
                  <RecentDocCard key={item.id} item={item} isNew={idx < 2} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Section label */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 15,
                color: BLUE,
                letterSpacing: -0.2,
              }}
            >
              {activeCategoryLabel}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: MUTED,
                marginLeft: 6,
              }}
            >
              ({filteredSections.length} бүлэг)
            </Text>
          </View>

          {/* Empty state */}
          {filteredSections.length === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <MaterialIcons
                name="search-off"
                size={42}
                color={MUTED}
                style={{ marginBottom: 12 }}
              />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 14,
                  color: MUTED,
                  textAlign: "center",
                }}
              >
                Хайлтын үр дүн олдсонгүй
              </Text>
            </View>
          )}

          {/* 2-column grid with staggered entry */}
          {rows.map((row, rowIdx) => (
            <View
              key={`${activeTab}-${searchQuery}-row-${rowIdx}`}
              style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}
            >
              {row[0] && (
                <StaggerCard delay={rowIdx * 55}>
                  <ChapterCard
                    section={row[0]}
                    onPress={goToChapter}
                    bookmarked={isBookmarked(row[0].id)}
                    onBookmark={() => toggle(row[0].id)}
                  />
                </StaggerCard>
              )}
              {row[1] ? (
                <StaggerCard delay={rowIdx * 55 + 40}>
                  <ChapterCard
                    section={row[1]}
                    onPress={goToChapter}
                    bookmarked={isBookmarked(row[1].id)}
                    onBookmark={() => toggle(row[1].id)}
                  />
                </StaggerCard>
              ) : (
                <View style={{ flex: 1 }} />
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Stagger Card wrapper ─────────────────────────────────────────

function StaggerCard({
  delay,
  children,
}: {
  delay: number;
  children: React.ReactNode;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(20);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
        delay,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay]);

  return (
    <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Category Chip ────────────────────────────────────────────────

function CategoryChip({
  tab,
  isActive,
  onPress,
}: {
  tab: { id: string; label: string };
  isActive: boolean;
  onPress: (id: string) => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.timing(scale, {
      toValue: 0.9,
      duration: 110,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  const pressOut = () =>
    Animated.timing(scale, {
      toValue: 1,
      duration: 160,
      easing: EASE,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => onPress(tab.id)}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: isActive ? BLUE : WHITE,
          borderWidth: 1,
          borderColor: isActive ? BLUE : BORDER,
        }}
      >
        <Text
          style={{
            fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
            fontSize: 13,
            color: isActive ? WHITE : MUTED,
            letterSpacing: 0.1,
          }}
        >
          {tab.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Chapter Card ─────────────────────────────────────────────────

function ChapterCard({
  section,
  onPress,
  bookmarked,
  onBookmark,
}: {
  section: HandbookSection;
  onPress: (s: HandbookSection) => void;
  bookmarked: boolean;
  onBookmark: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.timing(scale, {
      toValue: 0.96,
      duration: 100,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  const pressOut = () =>
    Animated.timing(scale, {
      toValue: 1,
      duration: 180,
      easing: EASE,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => onPress(section)}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{
          backgroundColor: WHITE,
          borderRadius: 16,
          padding: 16,
          minHeight: 138,
          borderWidth: 1,
          borderColor: bookmarked ? "rgba(8,21,143,0.25)" : BORDER,
          shadowColor: "rgba(8,21,143,0.06)",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 2,
          justifyContent: "space-between",
        }}
      >
        {/* Icon + bookmark row */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: "rgba(8,21,143,0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcons name={section.icon as any} size={24} color={BLUE} />
          </View>
          <TouchableOpacity
            onPress={onBookmark}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: bookmarked
                ? "rgba(8,21,143,0.10)"
                : "rgba(8,21,143,0.04)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcons
              name={bookmarked ? "bookmark" : "bookmark-border"}
              size={16}
              color={bookmarked ? BLUE : MUTED}
            />
          </TouchableOpacity>
        </View>

        {/* Text */}
        <View>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 13,
              color: BLUE,
              lineHeight: 18,
              marginBottom: 3,
            }}
          >
            {section.title}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: MUTED,
            }}
          >
            {section.description}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Search Result Card ───────────────────────────────────────────

function SearchResultCard({
  result,
  onPress,
}: {
  result: SearchResult;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.timing(scale, {
      toValue: 0.98,
      duration: 100,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  const pressOut = () =>
    Animated.timing(scale, {
      toValue: 1,
      duration: 180,
      easing: EASE,
      useNativeDriver: true,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{
          backgroundColor: WHITE,
          borderRadius: 14,
          padding: 14,
          borderWidth: 1,
          borderColor: BORDER,
          shadowColor: "rgba(8,21,143,0.05)",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: result.snippet ? 8 : 0,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "rgba(8,21,143,0.07)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <MaterialIcons
              name={result.section.icon as any}
              size={18}
              color={BLUE}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
                color: BLUE,
              }}
              numberOfLines={1}
            >
              {result.section.title}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 11,
                color: MUTED,
              }}
            >
              {result.section.titleEn}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={MUTED} />
        </View>
        {result.snippet ? (
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              lineHeight: 20,
              color: BODY,
            }}
            numberOfLines={3}
          >
            {result.snippet}
          </Text>
        ) : null}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Search Skeleton ──────────────────────────────────────────────

function SearchSkeleton() {
  const op = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue: 0.5,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        opacity: op,
        backgroundColor: WHITE,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: BORDER,
      }}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: BG,
            marginRight: 10,
          }}
        />
        <View>
          <View
            style={{
              width: 140,
              height: 12,
              borderRadius: 6,
              backgroundColor: BG,
              marginBottom: 6,
            }}
          />
          <View
            style={{
              width: 80,
              height: 10,
              borderRadius: 6,
              backgroundColor: BG,
            }}
          />
        </View>
      </View>
      <View
        style={{
          width: "100%",
          height: 11,
          borderRadius: 6,
          backgroundColor: BG,
          marginBottom: 6,
        }}
      />
      <View
        style={{
          width: "80%",
          height: 11,
          borderRadius: 6,
          backgroundColor: BG,
        }}
      />
    </Animated.View>
  );
}

// ─── Recent Document Card ─────────────────────────────────────────

function RecentDocCard({ item, isNew }: { item: QuickLink; isNew: boolean }) {
  const [opening, setOpening] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.timing(scale, {
      toValue: 0.96,
      duration: 80,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  const pressOut = () =>
    Animated.timing(scale, {
      toValue: 1,
      duration: 160,
      easing: EASE,
      useNativeDriver: true,
    }).start();

  const handleOpen = async () => {
    setOpening(true);
    try {
      await WebBrowser.openBrowserAsync(item.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    } finally {
      setOpening(false);
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleOpen}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={{
          width: 158,
          backgroundColor: WHITE,
          borderRadius: 16,
          padding: 14,
          borderWidth: 1,
          borderColor: BORDER,
          shadowColor: "rgba(8,21,143,0.06)",
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 1,
          shadowRadius: 10,
          elevation: 3,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "rgba(8,21,143,0.07)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {opening ? (
              <ActivityIndicator size="small" color={BLUE} />
            ) : (
              <MaterialIcons name="picture-as-pdf" size={19} color={BLUE} />
            )}
          </View>
          {isNew && (
            <View
              style={{
                backgroundColor: GOLD,
                borderRadius: 5,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 9,
                  color: BODY,
                  letterSpacing: 0.4,
                }}
              >
                ШИНЭ
              </Text>
            </View>
          )}
        </View>

        <Text
          numberOfLines={2}
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 12,
            color: BLUE,
            lineHeight: 17,
            marginBottom: 6,
          }}
        >
          {item.title}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            color: MUTED,
            letterSpacing: 0.2,
          }}
        >
          {item.category || "PDF"}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
