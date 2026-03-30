import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  ActivityIndicator,
  Image,
  StatusBar,
  Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useColorScheme } from "@/hooks/useColorScheme";
import { EaseOutExpo } from "@/constants/Theme";
import { Config } from "@/constants/config";

const EASE = Easing.bezier(...EaseOutExpo);

const BLUE = "#08158F";
const GOLD = "#FFC20D";
const BG = "#F8F9FA";
const WHITE = "#FFFFFF";
const BODY = "#1A1A2E";
const MUTED = "#6B7280";
const BORDER = "rgba(8,21,143,0.09)";

// Per-category accent colors for icon badges
const CATEGORY_COLORS: Record<string, string> = {
  rule: BLUE,
  procedure: "#5C6BC0",
  regulation: "#1E88E5",
  fee: "#00897B",
  form: "#00897B",
  handbook: BLUE,
  pdf: BLUE,
};

// ─── Types ────────────────────────────────────────────────────────

interface ResourceItem {
  id: string;
  title: string;
  url: string;
  source_type: "text_pdf" | "scanned_pdf" | "web_page" | string;
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

// ─── Main screen ──────────────────────────────────────────────────

export default function ResourcesScreen() {
  const isDark = useColorScheme() === "dark";
  const [data, setData] = useState<ResourcesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Header entrance
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

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(Config.RESOURCES_ENDPOINT, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch {
      setError(
        "Backend холболтгүй байна. Серверийг ажиллуулсан эсэхийг шалгана уу.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BLUE} />

      {/* ── Blue hero header ───────────────────────────────────── */}
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
          {/* Top row: logo + refresh */}
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
              onPress={fetchResources}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.13)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="refresh" size={19} color={WHITE} />
            </TouchableOpacity>
          </View>

          {/* Title + subtitle */}
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 26,
              color: WHITE,
              letterSpacing: -0.5,
              marginBottom: 4,
            }}
          >
            Баримт бичиг
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {data && (
              <View
                style={{
                  backgroundColor: GOLD,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 11,
                    color: BODY,
                  }}
                >
                  {data.total} баримт
                </Text>
              </View>
            )}
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              ШУТИС албан баримт бичгүүд
            </Text>
          </View>
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

      {/* ── Content ────────────────────────────────────────────── */}
      {loading && <LoadingState />}
      {!loading && error && (
        <ErrorState message={error} onRetry={fetchResources} />
      )}
      {!loading && !error && data && (
        <ScrollView
          style={{ flex: 1, marginTop: -1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 110,
          }}
          showsVerticalScrollIndicator={false}
        >
          {data.groups.map((group, i) => (
            <AccordionGroup
              key={group.category}
              group={group}
              index={i}
              defaultOpen={i === 0}
            />
          ))}

          {data.last_synced ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 8,
              }}
            >
              <MaterialIcons name="check-circle" size={13} color={MUTED} />
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 11,
                  color: MUTED,
                }}
              >
                {new Date(data.last_synced).toLocaleString("mn-MN")}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Accordion group ──────────────────────────────────────────────

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

  // Staggered entrance
  const enterOp = useRef(new Animated.Value(0)).current;
  const enterY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const delay = index * 70;
    Animated.parallel([
      Animated.timing(enterOp, {
        toValue: 1,
        duration: 400,
        delay,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(enterY, {
        toValue: 0,
        duration: 400,
        delay,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Chevron rotation — native driver
  const rotation   = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  // Border color + maxHeight — JS driver (can't use native for these)
  const openAnim   = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    Animated.parallel([
      Animated.timing(rotation, {
        toValue: next ? 1 : 0, duration: 260, easing: EASE, useNativeDriver: true,
      }),
      Animated.timing(openAnim, {
        toValue: next ? 1 : 0, duration: 300, easing: EASE, useNativeDriver: false,
      }),
    ]).start();
  };

  // Header press scale
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.timing(scale, {
      toValue: 0.985,
      duration: 80,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  const onPressOut = () =>
    Animated.timing(scale, {
      toValue: 1,
      duration: 160,
      easing: EASE,
      useNativeDriver: true,
    }).start();

  const rotate      = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const accentColor = CATEGORY_COLORS[group.category] ?? BLUE;
  const animBorder  = openAnim.interpolate({ inputRange: [0, 1], outputRange: ['rgba(8,21,143,0.09)', 'rgba(8,21,143,0.35)'] });
  const animHeight  = openAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 800] });

  return (
    <Animated.View
      style={{
        marginBottom: 12,
        opacity: enterOp,
        transform: [{ translateY: enterY }],
      }}
    >
      {/* ── Header — border (JS) wraps scale (native) ─────────── */}
      <Animated.View style={{
        borderWidth: 1,
        borderColor: animBorder,
        borderRadius: 16,
        borderBottomLeftRadius: expanded ? 0 : 16,
        borderBottomRightRadius: expanded ? 0 : 16,
      }}>
        <Animated.View style={{
          transform: [{ scale }],
          borderRadius: 15,
          borderBottomLeftRadius: expanded ? 0 : 15,
          borderBottomRightRadius: expanded ? 0 : 15,
          overflow: 'hidden',
        }}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={toggle}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={{ flexDirection: "row", alignItems: "center", backgroundColor: WHITE, paddingHorizontal: 14, paddingVertical: 13 }}
          >
            <View style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: expanded ? accentColor : accentColor + "15",
              alignItems: "center", justifyContent: "center", marginRight: 12,
            }}>
              <MaterialIcons name={group.icon as any} size={18} color={expanded ? WHITE : accentColor} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: BODY, letterSpacing: -0.1 }}>
                {group.label}
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: MUTED, marginTop: 2 }}>
                {group.items.length} баримт бичиг
              </Text>
            </View>

            <View style={{ backgroundColor: BG, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, marginRight: 8 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: MUTED }}>
                {group.items.length}
              </Text>
            </View>

            <Animated.View style={{ transform: [{ rotate }] }}>
              <MaterialIcons name="keyboard-arrow-down" size={22} color={MUTED} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>

      {/* ── Items — maxHeight animates open & close ────────────── */}
      <Animated.View style={{
        maxHeight: animHeight,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: animBorder,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        overflow: 'hidden',
      }}>
        {group.items.map((item, idx) => (
          <PDFRow
            key={item.id || idx}
            item={item}
            accentColor={accentColor}
            isLast={idx === group.items.length - 1}
            animDelay={idx * 40}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

// ─── PDF row ──────────────────────────────────────────────────────

function PDFRow({
  item,
  accentColor,
  isLast,
  animDelay,
}: {
  item: ResourceItem;
  accentColor: string;
  isLast: boolean;
  animDelay: number;
}) {
  const [opening, setOpening] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const enterOp = useRef(new Animated.Value(0)).current;
  const enterX = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(enterOp, {
        toValue: 1,
        duration: 280,
        delay: animDelay,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(enterX, {
        toValue: 0,
        duration: 280,
        delay: animDelay,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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

  const onPressIn = () =>
    Animated.timing(scale, {
      toValue: 0.975,
      duration: 80,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  const onPressOut = () =>
    Animated.timing(scale, {
      toValue: 1,
      duration: 160,
      easing: EASE,
      useNativeDriver: true,
    }).start();

  const isWebPage = item.source_type === "web_page";
  const iconName = isWebPage ? "language" : "picture-as-pdf";
  const iconColor = BLUE;
  const typeLabel = isWebPage ? "WEB" : "PDF";
  const typeBg = "rgba(8,21,143,0.07)";
  const typeColor = BLUE;

  return (
    <Animated.View
      style={{
        opacity: enterOp,
        transform: [{ translateX: enterX }, { scale }],
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: BORDER,
      }}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleOpen}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 13,
        }}
      >
        {/* File icon */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: "rgba(8,21,143,0.07)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
            flexShrink: 0,
          }}
        >
          <MaterialIcons name={iconName as any} size={17} color={iconColor} />
        </View>

        {/* Title */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              lineHeight: 19,
              color: BODY,
            }}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {/* Type badge */}
          <View
            style={{
              alignSelf: "flex-start",
              marginTop: 4,
              backgroundColor: typeBg,
              borderRadius: 4,
              paddingHorizontal: 6,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_700Bold",
                fontSize: 9,
                color: typeColor,
                letterSpacing: 0.6,
              }}
            >
              {typeLabel}
            </Text>
          </View>
        </View>

        {/* Open button */}
        <TouchableOpacity
          onPress={handleOpen}
          disabled={opening}
          style={{
            marginLeft: 10,
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: accentColor + "12",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {opening ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <MaterialIcons name="open-in-new" size={17} color={accentColor} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Loading state ────────────────────────────────────────────────

function LoadingState() {
  return (
    <View style={{ padding: 16, paddingTop: 20, gap: 12 }}>
      {[1, 2, 3, 4].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: WHITE,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: BORDER,
            padding: 14,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <SkeletonBox width={36} height={36} radius={10} />
          <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
            <SkeletonBar width={`${50 + i * 8}%`} height={13} />
            <SkeletonBar width="28%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Error state ──────────────────────────────────────────────────

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const op = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, {
        toValue: 1,
        duration: 360,
        easing: EASE,
        useNativeDriver: true,
      }),
      Animated.timing(y, {
        toValue: 0,
        duration: 360,
        easing: EASE,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        opacity: op,
        transform: [{ translateY: y }],
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: "rgba(8,21,143,0.06)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <MaterialIcons name="cloud-off" size={30} color={MUTED} />
      </View>
      <Text
        style={{
          fontFamily: "Inter_700Bold",
          fontSize: 16,
          color: BODY,
          marginBottom: 8,
        }}
      >
        Холболт тасарлаа
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 13,
          color: MUTED,
          textAlign: "center",
          lineHeight: 20,
          marginBottom: 24,
        }}
      >
        {message}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        style={{
          backgroundColor: BLUE,
          borderRadius: 14,
          paddingHorizontal: 28,
          paddingVertical: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <MaterialIcons name="refresh" size={16} color={WHITE} />
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 14,
            color: WHITE,
          }}
        >
          Дахин оролдох
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Skeleton helpers ─────────────────────────────────────────────

function SkeletonBar({
  width,
  height,
}: {
  width: `${number}%`;
  height: number;
}) {
  const op = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, {
          toValue: 0.9,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue: 0.4,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: 6,
        backgroundColor: "#E2E6F0",
        opacity: op,
      }}
    />
  );
}

function SkeletonBox({
  width,
  height,
  radius,
}: {
  width: number;
  height: number;
  radius: number;
}) {
  const op = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(op, {
          toValue: 0.9,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue: 0.4,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: "#E2E6F0",
        opacity: op,
      }}
    />
  );
}
