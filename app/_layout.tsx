import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";

import { BookmarkProvider } from "@/contexts/BookmarkContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { isOnboardingSeen } from "@/utils/storage";
import "../global.css";

SplashScreen.preventAutoHideAsync();

/**
 * Root auth gate — redirects based on token presence.
 * Must live inside <AuthProvider> so useAuth() works.
 */
function InitialLayout() {
  const { token, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const root = segments[0] as string | undefined;
    const inAuthRoute   = root === "login" || root === "register";
    const inOnboarding  = root === "onboarding";

    if (!isOnboardingSeen() && !inOnboarding) {
      router.replace("/onboarding");
    } else if (!token && !inAuthRoute && !inOnboarding) {
      router.replace("/login");
    } else if (token && inAuthRoute) {
      router.replace("/(tabs)");
    }
  }, [token, loading, segments]);

  return (
    <Stack>
      <Stack.Screen
        name="onboarding"
        options={{ headerShown: false, gestureEnabled: false, animation: "fade" }}
      />
      <Stack.Screen
        name="login"
        options={{ headerShown: false, animation: "fade" }}
      />
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false, animation: "fade" }}
      />
      <Stack.Screen
        name="handbook/[slug]"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="news/[id]"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <BookmarkProvider>
        <InitialLayout />
        <StatusBar style="auto" />
      </BookmarkProvider>
    </AuthProvider>
  );
}
