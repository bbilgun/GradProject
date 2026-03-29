import { Text, type TextProps } from "react-native";

import { useThemeColor } from "@/hooks/useThemeColor";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "subtitle" | "defaultSemiBold" | "link";
  className?: string;
};

const typeClasses: Record<NonNullable<ThemedTextProps["type"]>, string> = {
  default:         "text-base leading-6",
  defaultSemiBold: "text-base leading-6 font-semibold",
  title:           "text-3xl font-bold leading-tight",
  subtitle:        "text-xl font-semibold",
  link:            "text-base text-primary-600 dark:text-primary-400",
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  className = "",
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, "text");

  return (
    <Text
      className={`${typeClasses[type]} text-secondary-900 dark:text-white ${className}`}
      style={[{ color: lightColor || darkColor ? color : undefined }, style]}
      {...rest}
    />
  );
}
