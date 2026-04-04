import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { Config } from "@/constants/config";

// ── Types ─────────────────────────────────────────────────────────

interface NewsItem {
  id: number;
  title: string;
  cover_image_url: string | null;
  content: string | null;
  sections: { body: string }[];
  author_name: string | null;
  created_at: string;
}

// ── Design tokens ─────────────────────────────────────────────────

const BLUE   = "#08158F";
const GOLD   = "#FFC20D";
const BG     = "#F8F9FA";
const WHITE  = "#FFFFFF";
const MUTED  = "#6B7280";
const BODY   = "#1A1A2E";
const BORDER = "rgba(8,21,143,0.08)";

// ── Helpers ───────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return "Яг одоо";
  if (diff < 3600) return `${Math.floor(diff / 60)}м өмнө`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ц өмнө`;
  return new Date(iso).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

// ── Screen ────────────────────────────────────────────────────────

export default function NewsScreen() {
  const router = useRouter();
  const [news, setNews]         = useState<NewsItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

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

  useEffect(() => { fetchNews(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchNews(true); };

  // ── Empty / error states ─────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={BLUE} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>

        {/* ── Header ─────────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 24, color: BLUE, letterSpacing: -0.5 }}>
            Мэдээ мэдээлэл
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: MUTED, marginTop: 3 }}>
            ШУТИС оюутны зөвлөлийн мэдээнүүд
          </Text>
        </View>

        {/* ── List ───────────────────────────────────── */}
        <FlatList
          data={news}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 32,
            flexGrow: 1,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BLUE}
              colors={[BLUE]}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            error ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
                <MaterialIcons name="wifi-off" size={40} color={MUTED} />
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: MUTED, marginTop: 12, textAlign: "center" }}>
                  {error}
                </Text>
                <TouchableOpacity
                  onPress={() => fetchNews()}
                  style={{
                    marginTop: 16,
                    backgroundColor: BLUE,
                    borderRadius: 10,
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: WHITE }}>
                    Дахин оролдох
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
                <MaterialIcons name="newspaper" size={44} color={MUTED} />
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: MUTED, marginTop: 12 }}>
                  Одоогоор мэдээ байхгүй байна
                </Text>
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <NewsCard
              item={item}
              index={index}
              onPress={() => router.push(`/news/${item.id}` as any)}
            />
          )}
        />
      </SafeAreaView>
    </View>
  );
}

// ── NewsCard ──────────────────────────────────────────────────────

function NewsCard({ item, index, onPress }: { item: NewsItem; index: number; onPress: () => void }) {
  const isNew    = Date.now() - new Date(item.created_at).getTime() < 86_400_000 * 2;
  const coverUri = item.cover_image_url
    ? item.cover_image_url.startsWith("http")
      ? item.cover_image_url
      : `${Config.API_BASE}${item.cover_image_url}`
    : null;
  const snippet  = item.sections[0]?.body ?? item.content ?? "";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={{
        backgroundColor: WHITE,
        borderRadius: 18,
        overflow: "hidden",
        shadowColor: "rgba(8,21,143,0.10)",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 4,
      }}
    >
      {/* Cover image */}
      {coverUri && (
        <Image
          source={{ uri: coverUri }}
          style={{ width: "100%", height: 170 }}
          resizeMode="cover"
        />
      )}

      <View style={{ padding: 16 }}>
        {/* Title row */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: BODY, flex: 1, lineHeight: 22 }}>
            {item.title}
          </Text>
          {isNew && (
            <View style={{ backgroundColor: GOLD, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, marginTop: 2 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 9, color: "#5A3A00" }}>ШИНЭ</Text>
            </View>
          )}
        </View>

        {/* Snippet */}
        {!!snippet && (
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: MUTED, lineHeight: 20, marginBottom: 12 }} numberOfLines={2}>
            {snippet}
          </Text>
        )}

        {/* Footer */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialIcons name="person-outline" size={12} color={MUTED} />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: MUTED }}>
                {item.author_name ?? "Оюутны зөвлөл"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <MaterialIcons name="access-time" size={12} color={MUTED} />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: MUTED }}>
                {timeAgo(item.created_at)}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: BLUE }}>
              Унших
            </Text>
            <MaterialIcons name="arrow-forward" size={13} color={BLUE} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
