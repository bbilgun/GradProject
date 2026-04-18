import React from "react";
import {
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useRouter } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";

// ─── Design tokens ────────────────────────────────────────────────
const BLUE   = "#08158F";
const BLUE2  = "#0A1DB8";
const BLUE3  = "#1833D6";
const GOLD   = "#FFC20D";
const BG     = "#F0F2F8";
const WHITE  = "#FFFFFF";
const MUTED  = "#6B7280";
const SUBTLE = "#9CA3AF";
const BODY   = "#1A1A2E";
const LINE   = "rgba(10,20,50,0.06)";

// Per-row icon palette for the info card
const TINT = {
  blue:   { bg: "rgba(8,21,143,0.09)",   fg: BLUE },
  purple: { bg: "rgba(124,58,237,0.10)", fg: "#7C3AED" },
  indigo: { bg: "rgba(67,56,202,0.10)",  fg: "#4338CA" },
  amber:  { bg: "rgba(217,119,6,0.11)",  fg: "#D97706" },
  green:  { bg: "rgba(5,150,105,0.10)",  fg: "#059669" },
  teal:   { bg: "rgba(13,148,136,0.10)", fg: "#0D9488" },
} as const;

export default function ProfileScreen() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={BLUE} size="large" />
      </View>
    );
  }

  if (!user) return null;

  const roleLabel = {
    student:         "Оюутан",
    admin:           "Админ",
    student_council: "Оюутны зөвлөл",
  }[user.role] ?? user.role;

  const initials = (user.full_name ?? user.student_id)
    .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const gpaText = user.gpa != null ? user.gpa.toFixed(2) : "—";
  const creditsText = user.total_credits != null ? String(user.total_credits) : "—";

  const admissionYear = user.admission_year ? 2000 + Number(user.admission_year) : null;
  const admissionText = admissionYear ? String(admissionYear) : "—";

  // Program breadcrumb chips (filter out empties)
  const breadcrumb = [user.branch, user.department, user.major].filter(Boolean) as string[];

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* ── Gradient hero ───────────────────────────────────────── */}
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
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Image
                source={require("@/assets/images/main_logo.png")}
                style={{ width: 36, height: 36, borderRadius: 8 }}
                resizeMode="contain"
              />
              <View>
                <Text style={s.headerTitle}>Профайл</Text>
                <Text style={s.headerSub}>Оюутны мэдээлэл</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>

        <View style={s.heroCurve} />
      </LinearGradient>

      {/* ── Scrollable content ──────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Profile card ───────────────────────────────────────── */}
        <View style={s.profileCard}>
          {/* Gradient header strip */}
          <LinearGradient
            colors={[BLUE, BLUE3]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.profileCardStrip}
          >
            <View style={s.stripOrb1} />
            <View style={s.stripOrb2} />
            <View style={s.stripSparkle}>
              <MaterialIcons name="auto-awesome" size={12} color={GOLD} />
            </View>
          </LinearGradient>

          {/* Avatar overlapping the strip */}
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <View style={s.avatarDot}>
              <MaterialIcons name="verified" size={14} color={BLUE} />
            </View>
          </View>

          {/* Identity */}
          <View style={s.identity}>
            <Text style={s.profileName} numberOfLines={1}>
              {user.full_name ?? "—"}
            </Text>

            <View style={s.idRow}>
              <MaterialIcons name="badge" size={12} color={GOLD} />
              <Text style={s.profileId}>{user.student_id}</Text>
            </View>

            <View style={s.rolePill}>
              <View style={s.rolePillDot} />
              <Text style={s.rolePillText}>{roleLabel}</Text>
            </View>
          </View>

          {/* Stats strip */}
          <View style={s.statsRow}>
            <StatCell icon="auto-graph" value={gpaText}     label="Голч дүн" tint={GOLD} />
            <View style={s.statDivider} />
            <StatCell icon="menu-book"  value={creditsText} label="Кредит"   tint={BLUE} />
            <View style={s.statDivider} />
            <StatCell icon="event"      value={admissionText}  label="Элссэн"   tint="#059669" />
          </View>
        </View>

        {/* ── Program breadcrumb ────────────────────────────────── */}
        {breadcrumb.length > 0 && (
          <>
            <Text style={s.sectionHead}>ХӨТӨЛБӨР</Text>
            <View style={s.pathCard}>
              {breadcrumb.map((item, i) => (
                <React.Fragment key={i}>
                  <View style={s.pathItem}>
                    <View style={[s.pathDot, i === 0 && { backgroundColor: BLUE }, i === breadcrumb.length - 1 && { backgroundColor: GOLD }]} />
                    <Text style={s.pathText} numberOfLines={2}>{item}</Text>
                  </View>
                  {i < breadcrumb.length - 1 && <View style={s.pathLine} />}
                </React.Fragment>
              ))}
            </View>
          </>
        )}

        {/* ── Info section ────────────────────────────────────────── */}
        <Text style={s.sectionHead}>СУРГУУЛИЙН МЭДЭЭЛЭЛ</Text>
        <View style={s.card}>
          <InfoRow icon="account-balance" tint={TINT.blue}   label="Салбар сургууль"   value={user.branch ?? "—"} />
          <Divider />
          <InfoRow icon="business"        tint={TINT.purple} label="Салбар / Тэнхим"   value={user.department ?? "—"} />
          <Divider />
          <InfoRow icon="school"          tint={TINT.indigo} label="Хөтөлбөр / Анги"   value={user.major ?? "—"} />
          <Divider />
          <InfoRow icon="tag"             tint={TINT.amber}  label="Оюутны индекс" value={user.index ?? "—"} />
          <Divider />
          <InfoRow icon="class"           tint={TINT.green}  label="Ангийн код"        value={user.class_code ?? "—"} />
          <Divider />
          <InfoRow icon="mail-outline"    tint={TINT.teal}   label="И-мэйл хаяг"       value={user.email ?? "—"} />
        </View>

        {/* ── Other section ───────────────────────────────────────── */}
        <Text style={s.sectionHead}>БУСАД</Text>
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={() =>
            Alert.alert(
              "Системээс гарах",
              "Та гарахдаа итгэлтэй байна уу?",
              [
                { text: "Болих", style: "cancel" },
                { text: "Гарах", style: "destructive", onPress: handleLogout },
              ]
            )
          }
          activeOpacity={0.85}
          accessibilityLabel="Системээс гарах"
          accessibilityRole="button"
        >
          <View style={s.logoutIconWrap}>
            <MaterialIcons name="logout" size={18} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.logoutTitle}>Системээс гарах</Text>
            <Text style={s.logoutSub}>Өөр хэрэглэгчээр нэвтрэх</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color="#DC2626" />
        </TouchableOpacity>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <View style={s.footerBadge}>
          <MaterialIcons name="school" size={13} color={BLUE} />
          <Text style={s.footerText}>MUST · Smart Student Handbook</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function StatCell({ icon, value, label, tint }: {
  icon: string; value: string; label: string; tint: string;
}) {
  return (
    <View style={s.statCell}>
      <View style={[s.statIcon, { backgroundColor: tint + "18" }]}>
        <MaterialIcons name={icon as any} size={14} color={tint} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, tint }: {
  icon: string; label: string; value: string; tint: { bg: string; fg: string };
}) {
  return (
    <View style={s.infoRow}>
      <View style={[s.infoIcon, { backgroundColor: tint.bg }]}>
        <MaterialIcons name={icon as any} size={17} color={tint.fg} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={s.divider} />;
}

// ─── Styles ──────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1, marginTop: -28 },

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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22,
  },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 12 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 19, color: WHITE, letterSpacing: -0.2 },
  headerSub:   { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 1 },
  heroCurve:   {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: 40, backgroundColor: BG,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
  },

  // Profile card
  profileCard: {
    alignItems: "center",
    marginHorizontal: 18, marginBottom: 16,
    backgroundColor: WHITE, borderRadius: 24,
    overflow: "hidden",
    shadowColor: "rgba(8,21,143,0.14)",
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 22,
    elevation: 8,
  },
  profileCardStrip: {
    width: "100%", height: 76,
    overflow: "hidden",
  },
  stripOrb1: {
    position: "absolute",
    top: -30, right: -20,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: GOLD, opacity: 0.14,
  },
  stripOrb2: {
    position: "absolute",
    bottom: -40, left: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "#FFFFFF", opacity: 0.06,
  },
  stripSparkle: {
    position: "absolute",
    top: 16, right: 22,
  },

  // Avatar
  avatarWrap: {
    marginTop: -42,
    marginBottom: 12,
  },
  avatar: {
    width: 96, height: 96, borderRadius: 28,
    backgroundColor: BLUE,
    alignItems: "center", justifyContent: "center",
    borderWidth: 4, borderColor: WHITE,
    shadowColor: "rgba(8,21,143,0.25)",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12,
    elevation: 6,
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 30, color: WHITE, letterSpacing: 0.5 },
  avatarDot: {
    position: "absolute", right: -2, bottom: -2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: WHITE,
    alignItems: "center", justifyContent: "center",
    shadowColor: "rgba(0,0,0,0.15)",
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4,
    elevation: 3,
  },

  // Identity
  identity: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  profileName: {
    fontFamily: "Inter_700Bold", fontSize: 20, color: BODY,
    letterSpacing: -0.4, textAlign: "center",
  },
  idRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    marginTop: 5,
  },
  profileId: {
    fontFamily: "Inter_600SemiBold", fontSize: 12, color: MUTED,
    letterSpacing: 1.4,
  },
  rolePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 12,
    backgroundColor: "rgba(8,21,143,0.06)",
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,194,13,0.25)",
  },
  rolePillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  rolePillText: {
    fontFamily: "Inter_600SemiBold", fontSize: 11.5, color: BLUE,
    letterSpacing: 0.4,
  },

  // Stats strip
  statsRow: {
    flexDirection: "row", alignItems: "center",
    width: "100%",
    marginTop: 20,
    paddingVertical: 18, paddingHorizontal: 8,
    borderTopWidth: 1, borderTopColor: LINE,
    backgroundColor: "rgba(8,21,143,0.02)",
  },
  statCell: { flex: 1, alignItems: "center" },
  statIcon: {
    width: 28, height: 28, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  statValue:  { fontFamily: "Inter_700Bold", fontSize: 18, color: BODY, letterSpacing: -0.3 },
  statLabel:  { fontFamily: "Inter_500Medium", fontSize: 10.5, color: MUTED, marginTop: 3, letterSpacing: 0.4 },
  statDivider:{ width: 1, height: 36, backgroundColor: LINE },

  // Sections
  sectionHead: {
    fontFamily: "Inter_700Bold", fontSize: 10.5,
    color: MUTED, letterSpacing: 1.3,
    marginHorizontal: 26, marginBottom: 10, marginTop: 8,
  },

  // Generic card
  card: {
    backgroundColor: WHITE,
    marginHorizontal: 18, borderRadius: 20,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10,
    marginBottom: 16,
    shadowColor: "rgba(8,21,143,0.07)",
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 12,
    elevation: 2,
  },

  // Program breadcrumb
  pathCard: {
    backgroundColor: WHITE,
    marginHorizontal: 18, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 14,
    marginBottom: 16,
    shadowColor: "rgba(8,21,143,0.07)",
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 12,
    elevation: 2,
  },
  pathItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 6,
  },
  pathDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "rgba(8,21,143,0.25)",
  },
  pathText: {
    flex: 1,
    fontFamily: "Inter_600SemiBold", fontSize: 13, color: BODY,
  },
  pathLine: {
    width: 2, height: 14, borderRadius: 1,
    backgroundColor: LINE,
    marginLeft: 21,
  },

  // Info rows
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  infoIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  infoLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: MUTED, letterSpacing: 0.2 },
  infoValue: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: BODY, marginTop: 2 },
  divider:   { height: 1, backgroundColor: LINE, marginLeft: 48 },

  // Logout
  logoutBtn: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 18, paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 18, backgroundColor: WHITE,
    borderWidth: 1, borderColor: "rgba(220,38,38,0.14)",
    shadowColor: "rgba(220,38,38,0.08)",
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8,
    elevation: 2,
  },
  logoutIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(220,38,38,0.09)",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  logoutTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#DC2626" },
  logoutSub:   { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(220,38,38,0.65)", marginTop: 2 },

  // Footer
  footerBadge: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    marginTop: 28,
    alignSelf: "center",
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(8,21,143,0.05)",
    borderWidth: 1, borderColor: "rgba(8,21,143,0.08)",
  },
  footerText: {
    fontFamily: "Inter_600SemiBold", fontSize: 10.5, color: MUTED,
    letterSpacing: 0.8,
  },
});
