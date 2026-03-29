import { Link, Stack } from "expo-router";
import { View, Text } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View className="flex-1 items-center justify-center bg-white dark:bg-secondary-900 px-6">
        <Text className="text-6xl mb-4">🔍</Text>
        <Text className="text-2xl font-bold text-secondary-900 dark:text-white mb-2">
          Page Not Found
        </Text>
        <Text className="text-secondary-500 text-center mb-8">
          This screen doesn't exist.
        </Text>
        <Link href="/" className="text-primary-600 font-semibold text-base">
          Go to Home
        </Link>
      </View>
    </>
  );
}
