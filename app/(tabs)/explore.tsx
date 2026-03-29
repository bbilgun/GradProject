import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ExploreScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-secondary-900">
      <ScrollView className="flex-1" contentContainerClassName="px-6 py-8">
        <Text className="text-2xl font-bold text-secondary-900 dark:text-white mb-6">
          Explore
        </Text>

        <View className="gap-3">
          {["Routing", "Components", "Hooks", "Theming"].map((item) => (
            <View
              key={item}
              className="flex-row items-center bg-secondary-50 dark:bg-secondary-800 rounded-xl p-4 border border-secondary-200 dark:border-secondary-700"
            >
              <View className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 items-center justify-center mr-3">
                <Text className="text-primary-600 dark:text-primary-400 font-bold">
                  {item[0]}
                </Text>
              </View>
              <Text className="text-secondary-800 dark:text-secondary-200 font-medium flex-1">
                {item}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
