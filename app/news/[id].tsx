import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { Config } from "@/constants/config";
import { useBookmarks, SavedNewsItem } from "@/contexts/BookmarkContext";

// ── Types ─────────────────────────────────────────────────────────

interface NewsSection {
  id: number;
  subtitle: string | null;
  body: string;
  image_url: string | null;
  order: number;
}

interface NewsDetail {
  id: number;
  title: string;
  cover_image_url: string | null;
  content: string | null;
  sections: NewsSection[];
  author_name: string | null;
  created_at: string;
}

// ── Design tokens ─────────────────────────────────────────────────

const BLUE   = "#08158F";
const BG     = "#F8F9FA";
const WHITE  = "#FFFFFF";
const MUTED  = "#6B7280";
const BODY   = "#1A1A2E";
const BORDER = "rgba(8,21,143,0.08)";

function fullUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${Config.API_BASE}${url}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("mn-MN", {
    year: "numeric", month: "long", day: "numeric",
  });
}

// ── Screen ────────────────────────────────────────────────────────

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();

  const { toggleNews, isNewsSaved } = useBookmarks();
  const [news, setNews]     = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${Config.API_BASE}/news/${id}`);
        if (!res.ok) throw new Error("Мэдээ олдсонгүй.");
        setNews(await res.json());
      } catch (e: any) {
        setError(e.message ?? "Алдаа гарлаа.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={BLUE} size="large" />
      </View>
    );
  }

  if (error || !news) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <MaterialIcons name="error-outline" size={44} color={MUTED} />
        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 15, color: MUTED, marginTop: 12, textAlign: "center" }}>
          {error ?? "Мэдээ олдсонгүй."}
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 20, backgroundColor: BLUE, borderRadius: 10, paddingHorizontal: 22, paddingVertical: 11 }}
        >
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: WHITE }}>Буцах</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const coverUri = fullUrl(news.cover_image_url);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" />

      {/* ── Back header ──────────────────────────────────── */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: BLUE }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}
          >
            <MaterialIcons name="arrow-back" size={18} color={WHITE} />
          </TouchableOpacity>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: WHITE, letterSpacing: -0.2, flex: 1 }} numberOfLines={1}>
            {news?.title ?? "Мэдээ"}
          </Text>
          {news && (
            <TouchableOpacity
              onPress={() => toggleNews({
                id: news.id,
                title: news.title,
                cover_image_url: news.cover_image_url,
                is_special: false,
                content: news.content,
                sections: news.sections.map(s => ({ body: s.body })),
                author_name: news.author_name,
                created_at: news.created_at,
              })}
              style={{
                width: 38, height: 38, borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.12)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <MaterialIcons
                name={isNewsSaved(news.id) ? "bookmark" : "bookmark-border"}
                size={20}
                color={isNewsSaved(news.id) ? "#FFC20D" : WHITE}
              />
            </TouchableOpacity>
          )}
        </View>
        <View style={{ height: 24, backgroundColor: BG, borderTopLeftRadius: 24, borderTopRightRadius: 24 }} />
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* ── Cover image ──────────────────────────────── */}
        {coverUri && (
          <Image source={{ uri: coverUri }} style={{ width: "100%", height: 220 }} resizeMode="cover" />
        )}

        {/* ── Article body ─────────────────────────────── */}
        <View
          style={{
            backgroundColor: WHITE,
            borderTopLeftRadius: coverUri ? 20 : 0,
            borderTopRightRadius: coverUri ? 20 : 0,
            marginTop: coverUri ? -16 : 0,
            paddingHorizontal: 22,
            paddingTop: 26,
            paddingBottom: 48,
            minHeight: 400,
          }}
        >
          {/* Meta */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialIcons name="person-outline" size={13} color={MUTED} />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: MUTED }}>
                {news.author_name ?? "Оюутны зөвлөл"}
              </Text>
            </View>
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: MUTED }} />
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: MUTED }}>
              {fmtDate(news.created_at)}
            </Text>
          </View>

          {/* Title */}
          <Text
            style={{
              fontFamily: "Inter_700Bold", fontSize: 24, color: BODY,
              letterSpacing: -0.5, lineHeight: 32, marginBottom: 22,
            }}
          >
            {news.title}
          </Text>

          {/* Sections */}
          {news.sections.length > 0 ? (
            news.sections.map((sec, i) => (
              <SectionBlock key={sec.id} sec={sec} isLast={i === news.sections.length - 1} />
            ))
          ) : news.content ? (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 15, color: MUTED, lineHeight: 26 }}>
              {news.content}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Section block ─────────────────────────────────────────────────

function SectionBlock({ sec, isLast }: { sec: NewsSection; isLast: boolean }) {
  const imgUri = fullUrl(sec.image_url);

  return (
    <View style={{ marginBottom: isLast ? 0 : 28 }}>
      {sec.subtitle && (
        <Text
          style={{
            fontFamily: "Inter_700Bold", fontSize: 17, color: BLUE,
            letterSpacing: -0.3, marginBottom: 10, lineHeight: 24,
          }}
        >
          {sec.subtitle}
        </Text>
      )}

      <Text
        style={{
          fontFamily: "Inter_400Regular", fontSize: 15, color: "#374151",
          lineHeight: 26, marginBottom: imgUri ? 16 : 0,
        }}
      >
        {sec.body}
      </Text>

      {imgUri && (
        <Image
          source={{ uri: imgUri }}
          style={{ width: "100%", height: 220, borderRadius: 14 }}
          resizeMode="cover"
        />
      )}

      {!isLast && (
        <View style={{ height: 1, backgroundColor: BORDER, marginTop: 28 }} />
      )}
    </View>
  );
}
