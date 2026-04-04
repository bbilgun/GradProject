import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

const BLUE  = "#08158F";
const GOLD  = "#FFC20D";
const WHITE = "#FFFFFF";
const MUTED = "#6B7280";
const ERROR = "#DC2626";
const BG    = "#EEF0F8";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [studentId, setStudentId] = useState("");
  const [password,  setPassword]  = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

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
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 32 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Logo block ──────────────────────────────────── */}
            <View style={{ alignItems: "center", marginBottom: 36 }}>
              <Image
                source={require("@/assets/images/main_logo.png")}
                style={{ width: 100, height: 120 }}
                resizeMode="contain"
              />
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 22,
                  color: BLUE,
                  letterSpacing: -0.4,
                  marginTop: 14,
                }}
              >
                Оюутны портал
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: MUTED,
                  marginTop: 4,
                  letterSpacing: 0.1,
                }}
              >
                Шинжлэх Ухаан, Технологийн Их Сургууль
              </Text>
            </View>

            {/* ── Card ────────────────────────────────────────── */}
            <Animated.View
              style={{
                transform: [{ translateX: shakeX }],
                backgroundColor: WHITE,
                borderRadius: 24,
                padding: 24,
                shadowColor: "rgba(8,21,143,0.18)",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 1,
                shadowRadius: 24,
                elevation: 10,
              }}
            >
              {/* Student ID */}
              <Text style={labelStyle}>ОЮУТНЫ ДУГААР</Text>
              <View style={inputRow}>
                <MaterialIcons name="badge" size={18} color={MUTED} style={{ marginRight: 10 }} />
                <TextInput
                  value={studentId}
                  onChangeText={(t) => { setStudentId(t); setError(null); }}
                  placeholder="B221910027"
                  placeholderTextColor="#B0B7C3"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={10}
                  style={inputText}
                />
              </View>

              {/* Password */}
              <Text style={[labelStyle, { marginTop: 18 }]}>НУУЦ ҮГ</Text>
              <View style={inputRow}>
                <MaterialIcons name="lock-outline" size={18} color={MUTED} style={{ marginRight: 10 }} />
                <TextInput
                  value={password}
                  onChangeText={(t) => { setPassword(t); setError(null); }}
                  placeholder="••••••••"
                  placeholderTextColor="#B0B7C3"
                  secureTextEntry={!showPw}
                  style={[inputText, { flex: 1 }]}
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
              </View>

              {/* Error */}
              {error && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "rgba(220,38,38,0.07)",
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    marginTop: 14,
                  }}
                >
                  <MaterialIcons name="error-outline" size={15} color={ERROR} style={{ marginRight: 7 }} />
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: ERROR, flex: 1 }}>
                    {error}
                  </Text>
                </View>
              )}

              {/* Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
                style={{
                  marginTop: 24,
                  backgroundColor: loading ? "rgba(8,21,143,0.45)" : BLUE,
                  borderRadius: 14,
                  height: 52,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "rgba(8,21,143,0.5)",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 1,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                {loading ? (
                  <ActivityIndicator color={WHITE} />
                ) : (
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: WHITE, letterSpacing: 0.3 }}>
                    Нэвтрэх
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* ── Footer ──────────────────────────────────────── */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 28, gap: 6 }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD }} />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: MUTED }}>
                UNIMIS системийн нэвтрэх мэдээлэл ашиглана уу
              </Text>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: GOLD }} />
            </View>

          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const labelStyle = {
  fontFamily: "Inter_600SemiBold",
  fontSize: 11,
  color: MUTED,
  letterSpacing: 1,
  marginBottom: 8,
} as const;

const inputRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  backgroundColor: "#F4F5FB",
  borderRadius: 12,
  paddingHorizontal: 14,
  height: 50,
};

const inputText = {
  flex: 1,
  fontFamily: "Inter_500Medium",
  fontSize: 15,
  color: "#1A1A2E",
  letterSpacing: 0.3,
};
