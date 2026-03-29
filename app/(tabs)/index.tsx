import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/ui/Button";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-secondary-900">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 py-8"
      >
        <ThemedView className="items-center mb-8">
          <ThemedText
            type="title"
            className="text-center mb-2"
          >
            Welcome to MUST App
          </ThemedText>
          <ThemedText
            type="subtitle"
            className="text-center text-secondary-500"
          >
            React Native + Expo + NativeWind
          </ThemedText>
        </ThemedView>

        <View className="gap-4">
          <View className="bg-primary-50 dark:bg-primary-900 rounded-2xl p-5 border border-primary-100 dark:border-primary-800">
            <Text className="text-primary-700 dark:text-primary-300 font-semibold text-base mb-1">
              NativeWind CSS
            </Text>
            <Text className="text-secondary-600 dark:text-secondary-400 text-sm leading-relaxed">
              Tailwind CSS utility classes work natively on iOS, Android, and Web.
            </Text>
          </View>

          <View className="bg-secondary-50 dark:bg-secondary-800 rounded-2xl p-5 border border-secondary-200 dark:border-secondary-700">
            <Text className="text-secondary-800 dark:text-secondary-200 font-semibold text-base mb-1">
              Expo Router
            </Text>
            <Text className="text-secondary-500 dark:text-secondary-400 text-sm leading-relaxed">
              File-based routing with typed routes and deep linking out of the box.
            </Text>
          </View>

          <Button
            title="Get Started"
            onPress={() => {}}
            className="mt-2"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
