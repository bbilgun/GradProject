import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useAuth } from "@/contexts/AuthContext";

// ── Design tokens ─────────────────────────────────────────────────

const BLUE   = "#08158F";
const GOLD   = "#FFC20D";
const BG     = "#F8F9FA";
const WHITE  = "#FFFFFF";
const MUTED  = "#6B7280";
const BODY   = "#1A1A2E";
const BORDER = "rgba(8,21,143,0.10)";

// ─────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={BLUE} size="large" />
      </View>
    );
  }

  if (!user) {
    // Should never render — root layout redirects to login first
    return null;
  }

  const roleLabel = {
    student: "Оюутан",
    admin: "Админ",
    student_council: "Оюутны зөвлөл",
  }[user.role] ?? user.role;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {/* ── Header ─────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 8,
            paddingBottom: 16,
          }}
        >
          <Text
            style={{
              fontFamily: "Inter_700Bold",
              fontSize: 20,
              color: BLUE,
              letterSpacing: -0.4,
            }}
          >
            Миний профайл
          </Text>
          <TouchableOpacity
            onPress={logout}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "rgba(220,38,38,0.08)",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <MaterialIcons name="logout" size={15} color="#DC2626" />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: "#DC2626",
                marginLeft: 4,
              }}
            >
              Гарах
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Student ID Card ─────────────────────────────── */}
          <View
            style={{
              borderRadius: 22,
              overflow: "hidden",
              marginBottom: 20,
              shadowColor: "rgba(8,21,143,0.35)",
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 1,
              shadowRadius: 28,
              elevation: 14,
            }}
          >
            {/* Card top band */}
            <View style={{ backgroundColor: BLUE, paddingHorizontal: 22, paddingTop: 24, paddingBottom: 32 }}>
              {/* University row */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "rgba(255,194,13,0.22)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 10,
                  }}
                >
                  <MaterialIcons name="school" size={20} color={GOLD} />
                </View>
                <View>
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 13,
                      color: WHITE,
                      letterSpacing: 0.4,
                    }}
                  >
                    ШУТИС
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 10,
                      color: "rgba(255,255,255,0.6)",
                      letterSpacing: 0.2,
                    }}
                  >
                    Оюутны үнэмлэх
                  </Text>
                </View>

                {/* Role badge — top right */}
                <View
                  style={{
                    marginLeft: "auto",
                    backgroundColor: "rgba(255,194,13,0.2)",
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_600SemiBold",
                      fontSize: 10,
                      color: GOLD,
                      letterSpacing: 0.3,
                    }}
                  >
                    {roleLabel.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Avatar + name */}
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    backgroundColor: "rgba(255,255,255,0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: "rgba(255,255,255,0.25)",
                    marginRight: 16,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 26,
                      color: WHITE,
                    }}
                  >
                    {(user.full_name ?? user.student_id).charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 18,
                      color: WHITE,
                      letterSpacing: -0.3,
                      lineHeight: 24,
                    }}
                    numberOfLines={2}
                  >
                    {user.full_name ?? "—"}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                      color: GOLD,
                      letterSpacing: 1.2,
                      marginTop: 3,
                    }}
                  >
                    {user.student_id}
                  </Text>
                </View>
              </View>
            </View>

            {/* Card bottom — white section */}
            <View
              style={{
                backgroundColor: WHITE,
                paddingHorizontal: 22,
                paddingVertical: 18,
              }}
            >
              <InfoRow icon="work" label="Мэргэжил" value={user.major ?? "—"} />
              <View style={{ height: 1, backgroundColor: BORDER, marginVertical: 12 }} />

              {/* Stats row */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <StatCell
                  label="GPA"
                  value={user.gpa != null ? user.gpa.toFixed(2) : "—"}
                  icon="grade"
                  accent={GOLD}
                />
                <StatCell
                  label="Нийт кредит"
                  value={user.total_credits != null ? String(user.total_credits) : "—"}
                  icon="menu-book"
                  accent={BLUE}
                />
              </View>
            </View>
          </View>

          {/* ── Parsed ID info card ──────────────────────────── */}
          <View
            style={{
              backgroundColor: WHITE,
              borderRadius: 18,
              padding: 18,
              borderWidth: 1.5,
              borderColor: BORDER,
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
                color: MUTED,
                letterSpacing: 0.8,
                marginBottom: 14,
              }}
            >
              ОЮУТНЫ ДУГААРЫН ЗАДАРГАА
            </Text>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <IdChip label="Элсэлтийн жил" value={`20${user.admission_year}`} />
              <IdChip label="Ангийн код" value={user.class_code} />
              <IdChip label="Дугаар" value={user.index} />
            </View>
          </View>

          {/* ── Account info ─────────────────────────────────── */}
          <View
            style={{
              backgroundColor: WHITE,
              borderRadius: 18,
              padding: 18,
              borderWidth: 1.5,
              borderColor: BORDER,
            }}
          >
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 12,
                color: MUTED,
                letterSpacing: 0.8,
                marginBottom: 14,
              }}
            >
              БҮРТГЭЛИЙН МЭДЭЭЛЭЛ
            </Text>
            <InfoRow icon="email" label="Имэйл" value={user.email} />
            <View style={{ height: 1, backgroundColor: BORDER, marginVertical: 10 }} />
            <InfoRow icon="person" label="Эрх" value={roleLabel} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <MaterialIcons name={icon as any} size={18} color={MUTED} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            color: MUTED,
            letterSpacing: 0.3,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 14,
            color: BODY,
            marginTop: 1,
          }}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function StatCell({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: accent === GOLD ? "rgba(255,194,13,0.08)" : "rgba(8,21,143,0.06)",
        borderRadius: 14,
        padding: 14,
        alignItems: "center",
      }}
    >
      <MaterialIcons name={icon as any} size={20} color={accent} style={{ marginBottom: 6 }} />
      <Text
        style={{
          fontFamily: "Inter_700Bold",
          fontSize: 22,
          color: accent === GOLD ? "#996600" : BLUE,
          letterSpacing: -0.5,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 11,
          color: MUTED,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function IdChip({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: BG,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 8,
        alignItems: "center",
        borderWidth: 1,
        borderColor: BORDER,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter_700Bold",
          fontSize: 16,
          color: BLUE,
          letterSpacing: 0.5,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 10,
          color: MUTED,
          marginTop: 3,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </View>
  );
}
