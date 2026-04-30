import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
  StatusBar,
  TextInput,
  Keyboard,
  StyleSheet,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import HandbookService from "@/services/handbook_service";
import { useBookmarks } from "@/contexts/BookmarkContext";
import { EaseOutExpo } from "@/constants/Theme";
import { Config } from "@/constants/config";
import type { HandbookSection } from "@/services/handbook_service";

const EASE = Easing.bezier(...EaseOutExpo);

// ── Design tokens ─────────────────────────────────────────────────
const BLUE = "#08158F";
const BLUE2 = "#0A1DB8";
const BLUE3 = "#1833D6";
const GOLD = "#FFC20D";
const BG = "#FFFFFF";
const WHITE = "#FFFFFF";
const BODY = "#1A1A2E";
const MUTED = "#6B7280";
const BORDER = "rgba(8,21,143,0.07)";
const SURFACE = "#FFFFFF";

const CATEGORY_COLORS: Record<string, string> = {
  rule: "#4338CA",
  procedure: "#5C6BC0",
  regulation: "#1E88E5",
  fee: "#0D9488",
  form: "#059669",
  handbook: BLUE,
  pdf: BLUE,
  tuition: "#0D9488",
  order: "#7C3AED",
};

const CATEGORY_ICONS: Record<string, string> = {
  rule: "gavel",
  procedure: "description",
  regulation: "policy",
  fee: "payments",
  form: "assignment",
  handbook: "menu-book",
  pdf: "picture-as-pdf",
  tuition: "school",
  order: "receipt-long",
};

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

const HANDBOOK_TABS = [
  { id: "all", label: "Бүгд", icon: "apps" },
  { id: "general", label: "Ерөнхий", icon: "info" },
  { id: "schools", label: "Сургууль", icon: "school" },
  { id: "rules", label: "Дүрэм журам", icon: "gavel" },
  { id: "other", label: "Бусад", icon: "more-horiz" },
];

const ALL_SECTIONS = HandbookService.getAllSections();

// ─── Types ─────────────────────────────────────────────────────────

interface SearchResult {
  section: HandbookSection;
  snippet: string;
  sourceUrl: string;
  resultType: string;
  category: string;
}
interface ResourceItem {
  id: string;
  title: string;
  url: string;
  source_type: string;
}
interface ResourceGroup {
  label: string;
  category: string;
  icon: string;
  items: ResourceItem[];
}
interface ResourcesData {
  groups: ResourceGroup[];
  total: number;
  last_synced: string;
}

// ─── Main screen ───────────────────────────────────────────────────

export default function ExploreScreen() {
  const router = useRouter();
  const { toggle, isBookmarked } = useBookmarks();

  const headerOp = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOp, {
        toValue: 1,
        duration: 480,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(headerY, {
        toValue: 0,
        duration: 480,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      {/* ── Header ────────────────────────────────────────────────── */}
      <LinearGradient
        colors={[BLUE, BLUE2, BLUE3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.hero}
      >
        <View style={st.orbGold} />
        <View style={st.orbBlue} />
        <View style={st.orbTiny} />
        <SafeAreaView edges={["top"]}>
          <Animated.View
            style={[
              st.header,
              { opacity: headerOp, transform: [{ translateY: headerY }] },
            ]}
          >
            <View style={st.headerLeft}>
              <Image
                source={require("@/assets/images/main_logo.png")}
                style={st.headerLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={st.headerTitle}>Баримт бичиг</Text>
                <Text style={st.headerSub}>Гарын авлага & PDF баримтууд</Text>
              </View>
            </View>
          </Animated.View>
        </SafeAreaView>
        <View style={st.headerCurve} />
      </LinearGradient>

      <ContentPane
        router={router}
        toggle={toggle}
        isBookmarked={isBookmarked}
      />
    </View>
  );
}

// ─── Content pane ─────────────────────────────────────────────────

function ContentPane({
  router,
  toggle,
  isBookmarked,
}: {
  router: ReturnType<typeof useRouter>;
  toggle: (id: string) => void;
  isBookmarked: (id: string) => boolean;
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setFocused] = useState(false);
  const [searchResults, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [docsData, setDocsData] = useState<ResourcesData | null>(null);
  const [docsLoading, setDocsLoad] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docsQuery, setDocsQuery] = useState("");
  const [docsQFocused, setDocsQFocus] = useState(false);

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    Keyboard.dismiss();
    setSearching(true);
    setResults([]);
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
        return {
          section,
          snippet: r.text ?? "",
          sourceUrl: r.source_url ?? "",
          resultType: r.result_type ?? "semantic",
          category: r.category ?? "",
        };
      });
      setResults(mapped);
    } catch {
      const offline = HandbookService.searchLocal(q);
      setResults(offline.map((s) => ({
        section: s,
        snippet: s.description,
        sourceUrl: "",
        resultType: "local",
        category: "handbook",
      })));
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setResults(null);
  };

  const fetchDocs = useCallback(async () => {
    setDocsLoad(true);
    setDocsError(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(Config.RESOURCES_ENDPOINT, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDocsData(await res.json());
    } catch {
      setDocsError("Баримт бичгийг ачаалахад алдаа гарлаа.");
    } finally {
      setDocsLoad(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const filteredSections = useMemo(() => {
    let list = ALL_SECTIONS;
    if (activeTab !== "all")
      list = list.filter((s) => CATEGORY_MAP[s.id] === activeTab);
    return list;
  }, [activeTab]);

  const goToChapter = (section: HandbookSection) =>
    router.push({
      pathname: "/handbook/[slug]" as any,
      params: { slug: section.id },
    });

  const openSearchResult = async (result: SearchResult) => {
    if (result.sourceUrl?.startsWith("http")) {
      await WebBrowser.openBrowserAsync(result.sourceUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
      return;
    }
    goToChapter(result.section);
  };

  return (
    <>
      {/* ── Sticky search bar ───────────────────────────────────── */}
      <View style={st.stickyBar}>
        <View style={[st.searchPill, searchFocused && st.searchPillFocused]}>
          <MaterialIcons
            name="search"
            size={18}
            color={searchFocused ? BLUE : MUTED}
          />
          <TextInput
            placeholder="Гарын авлагаас хайх..."
            placeholderTextColor={MUTED}
            value={searchQuery}
            onChangeText={(t) => {
              setSearchQuery(t);
              if (!t) setResults(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            returnKeyType="search"
            onSubmitEditing={() => doSearch(searchQuery)}
            style={st.searchInput}
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

        {/* Category tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.tabRow}
        >
          {HANDBOOK_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[st.tabChip, active && st.tabChipActive]}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={tab.icon as any}
                  size={14}
                  color={active ? WHITE : MUTED}
                />
                <Text style={[st.tabLabel, active && st.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Search overlay ──────────────────────────────────────── */}
      {searchResults !== null && (
        <View style={{ flex: 1 }}>
          <View style={st.searchHeader}>
            <Text style={st.searchHeaderText}>
              {searching
                ? "Хайж байна..."
                : `${searchResults.length} үр дүн — "${searchQuery}"`}
            </Text>
            <TouchableOpacity
              onPress={clearSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={st.searchBack}>Буцах</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {searching && [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            {!searching && searchResults.length === 0 && (
              <EmptyState text="Үр дүн олдсонгүй" icon="search-off" />
            )}
            {!searching &&
              searchResults.map((r, idx) => (
                <SearchResultCard
                  key={`${r.section.id}-${idx}`}
                  result={r}
                  onPress={() => openSearchResult(r)}
                />
              ))}
          </ScrollView>
        </View>
      )}

      {/* ── Main content ────────────────────────────────────────── */}
      {searchResults === null && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Handbook chapters */}
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle} className="mt-4">
              {HANDBOOK_TABS.find((t) => t.id === activeTab)?.label ?? "Бүгд"}
            </Text>
            <View style={st.sectionBadge} className="mt-4">
              <Text style={st.sectionBadgeText}>
                {filteredSections.length} бүлэг
              </Text>
            </View>
          </View>

          {filteredSections.length === 0 && (
            <EmptyState text="Хайлтын үр дүн олдсонгүй" icon="search-off" />
          )}

          {filteredSections.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.chaptersRow}
            >
              {filteredSections.map((section) => (
                <ChapterCard
                  key={section.id}
                  section={section}
                  onPress={goToChapter}
                  bookmarked={isBookmarked(section.id)}
                  onBookmark={() => toggle(section.id)}
                />
              ))}
            </ScrollView>
          )}

          {/* ── Documents section ──────────────────────────────── */}
          <View style={st.dividerRow}>
            <View style={st.dividerLine} />
            <View style={st.dividerLabel}>
              <MaterialIcons name="folder-open" size={14} color={BLUE} />
              <Text style={st.dividerText}>Албан баримт бичиг</Text>
            </View>
            <View style={st.dividerLine} />
          </View>

          {docsLoading && <DocsLoadingState />}

          {!docsLoading && docsError && (
            <View
              style={{
                alignItems: "center",
                paddingVertical: 24,
                paddingHorizontal: 20,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: MUTED,
                  textAlign: "center",
                  marginBottom: 12,
                }}
              >
                {docsError}
              </Text>
              <TouchableOpacity onPress={fetchDocs} style={st.retryBtn}>
                <MaterialIcons name="refresh" size={15} color={WHITE} />
                <Text style={st.retryText}>Дахин оролдох</Text>
              </TouchableOpacity>
            </View>
          )}

          {!docsLoading && !docsError && docsData && (
            <View style={{ paddingHorizontal: 20 }}>
              {/* Stats bar */}
              <View style={st.docsTopBar}>
                <View style={st.docsBadge}>
                  <MaterialIcons name="description" size={13} color={WHITE} />
                  <Text style={st.docsBadgeText}>{docsData.total}</Text>
                </View>
                <Text style={st.docsSubtitle}>ШУТИС албан баримт бичгүүд</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={fetchDocs} style={st.refreshBtn}>
                  <MaterialIcons name="sync" size={16} color={BLUE} />
                </TouchableOpacity>
              </View>

              {/* Document search */}
              <View
                style={[
                  st.docsSearchPill,
                  docsQFocused && st.docsSearchPillFocused,
                ]}
              >
                <MaterialIcons
                  name="search"
                  size={16}
                  color={docsQFocused ? BLUE : MUTED}
                />
                <TextInput
                  placeholder="Баримт бичгүүдээс хайх..."
                  placeholderTextColor={MUTED}
                  value={docsQuery}
                  onChangeText={setDocsQuery}
                  onFocus={() => setDocsQFocus(true)}
                  onBlur={() => setDocsQFocus(false)}
                  style={st.docsSearchInput}
                />
                {docsQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setDocsQuery("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons name="close" size={16} color={MUTED} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filtered accordion list */}
              {(() => {
                const q = docsQuery.trim().toLowerCase();
                const groups = q
                  ? docsData.groups
                      .map((g) => ({
                        ...g,
                        items: g.items.filter((i) =>
                          i.title.toLowerCase().includes(q),
                        ),
                      }))
                      .filter((g) => g.items.length > 0)
                  : docsData.groups;

                if (q && groups.length === 0) {
                  return (
                    <EmptyState
                      text={`"${docsQuery}" — үр дүн олдсонгүй`}
                      icon="search-off"
                    />
                  );
                }

                return groups.map((group, i) => (
                  <AccordionGroup
                    key={group.category}
                    group={group}
                    index={i}
                    defaultOpen={q.length > 0}
                  />
                ));
              })()}

              {docsData.last_synced && (
                <View style={st.syncRow}>
                  <MaterialIcons name="check-circle" size={12} color={MUTED} />
                  <Text style={st.syncText}>
                    Сүүлд шинэчлэгдсэн:{" "}
                    {new Date(docsData.last_synced).toLocaleString("mn-MN")}
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </>
  );
}

// ─── Accordion group ───────────────────────────────────────────────

function AccordionGroup({
  group,
  index,
  defaultOpen,
}: {
  group: ResourceGroup;
  index: number;
  defaultOpen: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const enterOp = useRef(new Animated.Value(0)).current;
  const enterY = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    const delay = index * 60;
    Animated.parallel([
      Animated.timing(enterOp, {
        toValue: 1,
        duration: 380,
        delay,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(enterY, {
        toValue: 0,
        duration: 380,
        delay,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const rotation = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const openAnim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const onToggle = () => {
    const next = !expanded;
    setExpanded(next);
    Animated.parallel([
      Animated.timing(rotation, {
        toValue: next ? 1 : 0,
        duration: 260,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(openAnim, {
        toValue: next ? 1 : 0,
        duration: 300,
        easing: EASE,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const animHeight = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 800],
  });
  const accent = CATEGORY_COLORS[group.category] ?? BLUE;

  return (
    <Animated.View
      style={[
        st.accordionWrap,
        { opacity: enterOp, transform: [{ translateY: enterY }] },
      ]}
    >
      {/* Header */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onToggle}
        style={st.accordionHeader}
      >
        <View
          style={[
            st.accordionIcon,
            { backgroundColor: expanded ? accent : accent + "14" },
          ]}
        >
          <MaterialIcons
            name={(CATEGORY_ICONS[group.category] ?? group.icon) as any}
            size={17}
            color={expanded ? WHITE : accent}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.accordionTitle}>{group.label}</Text>
          <Text style={st.accordionCount}>
            {group.items.length} баримт бичиг
          </Text>
        </View>
        <View style={st.accordionBadge}>
          <Text style={st.accordionBadgeText}>{group.items.length}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <MaterialIcons name="keyboard-arrow-down" size={22} color={MUTED} />
        </Animated.View>
      </TouchableOpacity>

      {/* Body */}
      <Animated.View style={{ maxHeight: animHeight, overflow: "hidden" }}>
        {group.items.map((item, idx) => (
          <PDFRow
            key={item.id || idx}
            item={item}
            accent={accent}
            isLast={idx === group.items.length - 1}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

// ─── PDF row ───────────────────────────────────────────────────────

function PDFRow({
  item,
  accent,
  isLast,
}: {
  item: ResourceItem;
  accent: string;
  isLast: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const isWeb = item.source_type === "web_page";

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
    <TouchableOpacity
      activeOpacity={0.65}
      onPress={handleOpen}
      style={[st.pdfRow, !isLast && st.pdfRowBorder]}
    >
      <View style={st.pdfIcon}>
        <MaterialIcons
          name={isWeb ? "language" : "picture-as-pdf"}
          size={16}
          color={BLUE}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.pdfTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={st.pdfTypeBadge}>
          <Text style={st.pdfTypeText}>{isWeb ? "WEB" : "PDF"}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={handleOpen}
        disabled={opening}
        style={[st.pdfOpenBtn, { backgroundColor: accent + "12" }]}
      >
        {opening ? (
          <ActivityIndicator size="small" color={accent} />
        ) : (
          <MaterialIcons name="open-in-new" size={16} color={accent} />
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Chapter card ──────────────────────────────────────────────────

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
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => onPress(section)}
        onPressIn={() =>
          Animated.timing(scale, {
            toValue: 0.96,
            duration: 100,
            easing: EASE,
            useNativeDriver: true,
          }).start()
        }
        onPressOut={() =>
          Animated.timing(scale, {
            toValue: 1,
            duration: 180,
            easing: EASE,
            useNativeDriver: true,
          }).start()
        }
        style={[st.chapterCard, bookmarked && { borderColor: BLUE + "40" }]}
      >
        <View style={st.chapterTop}>
          <View style={st.chapterIcon}>
            <MaterialIcons name={section.icon as any} size={22} color={BLUE} />
          </View>
          <TouchableOpacity
            onPress={onBookmark}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              st.bookmarkBtn,
              bookmarked && { backgroundColor: BLUE + "14" },
            ]}
          >
            <MaterialIcons
              name={bookmarked ? "bookmark" : "bookmark-border"}
              size={15}
              color={bookmarked ? BLUE : MUTED}
            />
          </TouchableOpacity>
        </View>
        <View>
          <Text numberOfLines={2} style={st.chapterTitle}>
            {section.title}
          </Text>
          <Text numberOfLines={1} style={st.chapterDesc}>
            {section.description}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Search result card ────────────────────────────────────────────

function SearchResultCard({
  result,
  onPress,
}: {
  result: SearchResult;
  onPress: () => void;
}) {
  const hasExternalSource = result.sourceUrl?.startsWith("http");
  const badgeLabel = hasExternalSource
    ? result.sourceUrl.toLowerCase().includes(".pdf")
      ? "PDF"
      : "WEB"
    : "Гарын авлага";
  const iconName = hasExternalSource
    ? result.sourceUrl.toLowerCase().includes(".pdf")
      ? "picture-as-pdf"
      : "language"
    : result.section.icon;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={st.resultCard}
    >
      <View style={st.resultTop}>
        <View style={st.resultIcon}>
          <MaterialIcons
            name={iconName as any}
            size={18}
            color={BLUE}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.resultTitle} numberOfLines={1}>
            {result.section.title}
          </Text>
          <View style={st.resultMetaRow}>
            <View style={st.resultBadge}>
              <Text style={st.resultBadgeText}>{badgeLabel}</Text>
            </View>
            {!!result.category && (
              <Text style={st.resultSub} numberOfLines={1}>
                {result.category}
              </Text>
            )}
          </View>
        </View>
        <MaterialIcons
          name={hasExternalSource ? "open-in-new" : "chevron-right"}
          size={18}
          color={MUTED}
        />
      </View>
      {result.snippet ? (
        <Text style={st.resultSnippet} numberOfLines={3}>
          {result.snippet}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Utility components ────────────────────────────────────────────

function EmptyState({ text, icon }: { text: string; icon: string }) {
  return (
    <View style={st.emptyWrap}>
      <View style={st.emptyCircle}>
        <MaterialIcons name={icon as any} size={32} color={MUTED} />
      </View>
      <Text style={st.emptyText}>{text}</Text>
    </View>
  );
}

function SkeletonCard() {
  const op = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, {
          toValue: 0.9,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue: 0.45,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View style={[st.skeletonCard, { opacity: op }]}>
      <View
        style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}
      >
        <View style={st.skeletonCircle} />
        <View>
          <View style={[st.skeletonBar, { width: 140, marginBottom: 6 }]} />
          <View style={[st.skeletonBar, { width: 80 }]} />
        </View>
      </View>
      <View style={[st.skeletonBar, { width: "100%", marginBottom: 6 }]} />
      <View style={[st.skeletonBar, { width: "75%" }]} />
    </Animated.View>
  );
}

function DocsLoadingState() {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 12 }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={st.docsSkeletonRow}>
          <View style={st.skeletonCircle} />
          <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
            <View
              style={[st.skeletonBar, { width: `${45 + i * 10}%` as any }]}
            />
            <View style={[st.skeletonBar, { width: "30%" }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Hero
  hero: { paddingBottom: 38, overflow: "hidden" },
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

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
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
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: 40, backgroundColor: BG,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
  },

  // Sticky bar
  stickyBar: {
    backgroundColor: BG,
    zIndex: 10,
    marginTop: -16,
  },
  searchPill: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 8,
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
  tabRow: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabChipActive: { backgroundColor: BLUE, borderColor: BLUE },
  tabLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: MUTED },
  tabLabelActive: { color: WHITE, fontFamily: "Inter_600SemiBold" },

  // Search overlay
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  searchHeaderText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: MUTED,
    flex: 1,
  },
  searchBack: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: BLUE },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: BLUE,
    letterSpacing: -0.2,
  },
  sectionBadge: {
    backgroundColor: BLUE + "12",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: BLUE,
  },

  // Chapters row
  chaptersRow: { gap: 12, paddingHorizontal: 20, paddingBottom: 4 },

  // Chapter card
  chapterCard: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 16,
    width: 152,
    height: 156,
    borderWidth: 1,
    borderColor: BORDER,
    justifyContent: "space-between",
    shadowColor: "#08158F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  chapterTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  chapterIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: BLUE + "0A",
    alignItems: "center",
    justifyContent: "center",
  },
  bookmarkBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  chapterTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: BLUE,
    lineHeight: 18,
    marginBottom: 3,
  },
  chapterDesc: { fontFamily: "Inter_400Regular", fontSize: 11, color: MUTED },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerLabel: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 14,
    gap: 6,
  },
  dividerText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: BLUE },

  // Docs top bar
  docsTopBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  docsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: BLUE,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  docsBadgeText: { fontFamily: "Inter_700Bold", fontSize: 12, color: WHITE },
  docsSubtitle: { fontFamily: "Inter_400Regular", fontSize: 12, color: MUTED },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: BLUE + "0A",
    alignItems: "center",
    justifyContent: "center",
  },

  // Docs search
  docsSearchPill: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  docsSearchPillFocused: { borderColor: BLUE, backgroundColor: WHITE },
  docsSearchInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 0,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: BODY,
  },

  // Accordion
  accordionWrap: {
    marginBottom: 10,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    shadowColor: "#08158F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  accordionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  accordionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: BODY,
    letterSpacing: -0.1,
  },
  accordionCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: MUTED,
    marginTop: 1,
  },
  accordionBadge: {
    backgroundColor: BG,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginRight: 6,
  },
  accordionBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: MUTED,
  },

  // PDF row
  pdfRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: SURFACE,
  },
  pdfRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  pdfIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: BLUE + "08",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  pdfTitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: BODY,
  },
  pdfTypeBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: BLUE + "0A",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pdfTypeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: BLUE,
    letterSpacing: 0.6,
  },
  pdfOpenBtn: {
    marginLeft: 10,
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  // Search result card
  resultCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#08158F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  resultTop: { flexDirection: "row", alignItems: "center" },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: BLUE + "0A",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  resultTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: BLUE },
  resultMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  resultBadge: {
    alignSelf: "flex-start",
    backgroundColor: BLUE + "0A",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  resultBadgeText: {
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    color: BLUE,
    letterSpacing: 0.5,
  },
  resultSub: { fontFamily: "Inter_400Regular", fontSize: 11, color: MUTED },
  resultSnippet: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: BODY,
    marginTop: 8,
  },

  // Empty
  emptyWrap: { alignItems: "center", paddingVertical: 40 },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: MUTED,
    textAlign: "center",
  },

  // Retry
  retryBtn: {
    backgroundColor: BLUE,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  retryText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: WHITE },

  // Skeleton
  skeletonCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  skeletonCircle: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: BG,
    marginRight: 10,
  },
  skeletonBar: { height: 12, borderRadius: 6, backgroundColor: BG },
  docsSkeletonRow: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  // Sync row
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    marginBottom: 8,
  },
  syncText: { fontFamily: "Inter_400Regular", fontSize: 11, color: MUTED },
});
