import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

// ─── Design tokens ─────────────────────────────────────────────────
const BLUE  = "#08158F";
const BLUE2 = "#0A1DB8";
const BLUE3 = "#1833D6";
const GOLD  = "#FFC20D";
const WHITE = "#FFFFFF";
const BODY  = "#1A1A2E";
const MUTED = "#6B7280";
const SUBTLE = "#9CA3AF";
const ERROR = "#DC2626";
const BG    = "#F0F2F8";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [studentId, setStudentId] = useState("");
  const [password,  setPassword]  = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [focused,   setFocused]   = useState<"id" | "pw" | null>(null);

  const idRef = useRef<TextInput>(null);
  const pwRef = useRef<TextInput>(null);
  const shakeX = useRef(new Animated.Value(0)).current;

  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -10, duration: 55, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeX, { toValue:  10, duration: 55, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeX, { toValue:  -7, duration: 55, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeX, { toValue:   7, duration: 55, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeX, { toValue:   0, duration: 55, useNativeDriver: true, easing: Easing.linear }),
    ]).start();

  const handleLogin = async () => {
    setError(null);
    const id = studentId.trim().toUpperCase();
    if (!/^B\d{9}$/.test(id)) {
      setError("Оюутны дугаар буруу байна. Жишээ: B221910027");
      shake();
      return;
    }
    if (password.length < 8) {
      setError("Нууц үг дор хаяж 8 тэмдэгт байх ёстой.");
      shake();
      return;
    }
    setLoading(true);
    try {
      await login(id, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message ?? "Нэвтрэхэд алдаа гарлаа.");
      shake();
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar style="light" />

      {/* ── Gradient hero with orbs ─────────────────────────── */}
      <LinearGradient
        colors={[BLUE, BLUE2, BLUE3]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        <View style={s.orbGold} />
        <View style={s.orbWhite} />
        <View style={s.orbTiny} />
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <ScrollView
            contentContainerStyle={s.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Brand block ──────────────────────────────── */}
            <View style={s.brand}>
              <View style={s.logoPlate}>
                <Image
                  source={require("@/assets/images/main_logo.png")}
                  style={{ width: 70, height: 82 }}
                  resizeMode="contain"
                />
              </View>

              <View style={s.brandPill}>
                <View style={s.brandDot} />
                <Text style={s.brandPillText}>MUST · SMART HANDBOOK</Text>
              </View>

              <Text style={s.brandTitle}>Оюутны портал</Text>
              <Text style={s.brandSub}>
                Тавтай морилно уу. Үргэлжлүүлэхийн тулд нэвтэрнэ үү.
              </Text>
            </View>

            {/* ── Card ──────────────────────────────────────── */}
            <Animated.View
              style={[s.card, { transform: [{ translateX: shakeX }] }]}
            >
              <View style={s.cardHead}>
                <Text style={s.cardTitle}>Нэвтрэх</Text>
                <Text style={s.cardSub}>UNIMIS мэдээллээ ашиглана уу</Text>
              </View>

              {/* Student ID */}
              <Text style={s.label}>ОЮУТНЫ ДУГААР</Text>
              <Pressable
                onPress={() => idRef.current?.focus()}
                style={[
                  s.inputRow,
                  focused === "id" && s.inputRowFocus,
                ]}
              >
                <View style={s.inputIcon} pointerEvents="none">
                  <MaterialIcons name="badge" size={16} color={BLUE} />
                </View>
                <TextInput
                  ref={idRef}
                  value={studentId}
                  onChangeText={(t) => { setStudentId(t); setError(null); }}
                  onFocus={() => setFocused("id")}
                  onBlur={() => setFocused(null)}
                  placeholder="B221910027"
                  placeholderTextColor="#B0B7C3"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={10}
                  returnKeyType="next"
                  onSubmitEditing={() => pwRef.current?.focus()}
                  style={s.inputText}
                />
              </Pressable>

              {/* Password */}
              <Text style={[s.label, { marginTop: 16 }]}>НУУЦ ҮГ</Text>
              <Pressable
                onPress={() => pwRef.current?.focus()}
                style={[
                  s.inputRow,
                  focused === "pw" && s.inputRowFocus,
                ]}
              >
                <View style={s.inputIcon} pointerEvents="none">
                  <MaterialIcons name="lock-outline" size={16} color={BLUE} />
                </View>
                <TextInput
                  ref={pwRef}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(null); }}
                  onFocus={() => setFocused("pw")}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••"
                  placeholderTextColor="#B0B7C3"
                  secureTextEntry={!showPw}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  style={[s.inputText, { flex: 1 }]}
                />
                <TouchableOpacity
                  onPress={() => setShowPw((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons
                    name={showPw ? "visibility-off" : "visibility"}
                    size={18}
                    color={MUTED}
                  />
                </TouchableOpacity>
              </Pressable>

              {/* Error */}
              {error && (
                <View style={s.errorBox}>
                  <MaterialIcons name="error-outline" size={15} color={ERROR} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.88}
                style={s.submitShadow}
              >
                <LinearGradient
                  colors={loading ? ["#6E78C5", "#6E78C5"] : [BLUE, BLUE3]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.submitBtn}
                >
                  {loading ? (
                    <ActivityIndicator color={WHITE} />
                  ) : (
                    <>
                      <Text style={s.submitText}>Нэвтрэх</Text>
                      <MaterialIcons name="arrow-forward" size={18} color={WHITE} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* ── Perks row ─────────────────────────────────── */}
            <View style={s.perkRow}>
              <Perk icon="auto-stories" label="Гарын авлага" />
              <View style={s.perkDivider} />
              <Perk icon="psychology"   label="AI туслах" />
              <View style={s.perkDivider} />
              <Perk icon="campaign"     label="Мэдээ" />
            </View>

            {/* ── Footer ────────────────────────────────────── */}
            <View style={s.footer}>
              <View style={s.footerDot} />
              <Text style={s.footerText}>
                Шинжлэх Ухаан, Технологийн Их Сургууль
              </Text>
              <View style={s.footerDot} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Perk({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={s.perkCell}>
      <View style={s.perkIcon}>
        <MaterialIcons name={icon as any} size={15} color={BLUE} />
      </View>
      <Text style={s.perkLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Hero
  hero: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    height: 360,
    overflow: "hidden",
  },
  orbGold: {
    position: "absolute",
    top: -60, right: -50,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: GOLD, opacity: 0.14,
  },
  orbWhite: {
    position: "absolute",
    top: 80, left: -90,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: "#FFFFFF", opacity: 0.06,
  },
  orbTiny: {
    position: "absolute",
    top: 120, right: 70,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: GOLD, opacity: 0.9,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },

  // Brand
  brand: { alignItems: "center", marginTop: 12, marginBottom: 28 },
  logoPlate: {
    width: 92, height: 92, borderRadius: 22,
    backgroundColor: WHITE,
    alignItems: "center", justifyContent: "center",
    shadowColor: "rgba(8,21,143,0.35)",
    shadowOffset: { width: 0, height: 10 }, shadowOpacity: 1, shadowRadius: 22,
    elevation: 10,
  },
  brandPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 16,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1, borderColor: "rgba(255,194,13,0.35)",
  },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  brandPillText: {
    fontFamily: "Inter_700Bold", fontSize: 10, color: WHITE,
    letterSpacing: 1.4,
  },
  brandTitle: {
    fontFamily: "Inter_700Bold", fontSize: 26, color: WHITE,
    letterSpacing: -0.6, marginTop: 14,
  },
  brandSub: {
    fontFamily: "Inter_400Regular", fontSize: 13,
    color: "rgba(255,255,255,0.78)",
    marginTop: 6, textAlign: "center",
    paddingHorizontal: 16,
  },

  // Card
  card: {
    backgroundColor: WHITE,
    borderRadius: 24,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 22,
    shadowColor: "rgba(8,21,143,0.22)",
    shadowOffset: { width: 0, height: 14 }, shadowOpacity: 1, shadowRadius: 28,
    elevation: 14,
  },
  cardHead: { marginBottom: 18 },
  cardTitle: {
    fontFamily: "Inter_700Bold", fontSize: 20, color: BODY,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontFamily: "Inter_400Regular", fontSize: 12, color: MUTED,
    marginTop: 2,
  },

  label: {
    fontFamily: "Inter_700Bold", fontSize: 10.5, color: MUTED,
    letterSpacing: 1.3, marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F6F7FB",
    borderRadius: 14,
    paddingHorizontal: 10, paddingRight: 14,
    height: 52,
    borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  inputRowFocus: {
    backgroundColor: WHITE,
    borderColor: BLUE,
    shadowColor: "rgba(8,21,143,0.18)",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12,
    elevation: 4,
  },
  inputRowError: { borderColor: "rgba(220,38,38,0.45)" },
  inputIcon: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: "rgba(8,21,143,0.08)",
    alignItems: "center", justifyContent: "center",
    marginRight: 10,
  },
  inputText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: BODY,
    letterSpacing: 0.3,
  },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(220,38,38,0.08)",
    borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 14,
    borderWidth: 1, borderColor: "rgba(220,38,38,0.18)",
  },
  errorText: {
    flex: 1,
    fontFamily: "Inter_500Medium", fontSize: 12.5, color: ERROR,
  },

  submitShadow: {
    marginTop: 22,
    borderRadius: 16,
    shadowColor: "rgba(8,21,143,0.45)",
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 18,
    elevation: 10,
  },
  submitBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitText: {
    fontFamily: "Inter_700Bold", fontSize: 15, color: WHITE,
    letterSpacing: 0.4,
  },

  // Perks
  perkRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginTop: 22, marginHorizontal: 4,
    backgroundColor: WHITE,
    borderRadius: 18,
    paddingVertical: 12, paddingHorizontal: 8,
    shadowColor: "rgba(8,21,143,0.07)",
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 10,
    elevation: 2,
  },
  perkCell: { flex: 1, alignItems: "center", gap: 5 },
  perkIcon: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: "rgba(8,21,143,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  perkLabel: {
    fontFamily: "Inter_600SemiBold", fontSize: 11, color: BODY,
    letterSpacing: 0.2,
  },
  perkDivider: { width: 1, height: 26, backgroundColor: "rgba(10,20,50,0.08)" },

  // Footer
  footer: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 22,
  },
  footerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD },
  footerText: {
    fontFamily: "Inter_500Medium", fontSize: 11.5, color: SUBTLE,
    letterSpacing: 0.3,
  },
});
