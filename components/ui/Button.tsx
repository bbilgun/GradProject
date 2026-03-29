import { TouchableOpacity, Text, type TouchableOpacityProps } from "react-native";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = TouchableOpacityProps & {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const variantClasses: Record<ButtonVariant, { container: string; text: string }> = {
  primary:   { container: "bg-primary-600 active:bg-primary-700",                          text: "text-white font-semibold" },
  secondary: { container: "bg-secondary-600 active:bg-secondary-700",                      text: "text-white font-semibold" },
  outline:   { container: "border-2 border-primary-600 bg-transparent active:bg-primary-50", text: "text-primary-600 font-semibold" },
  ghost:     { container: "bg-transparent active:bg-secondary-100",                         text: "text-primary-600 font-semibold" },
};

const sizeClasses: Record<ButtonSize, { container: string; text: string }> = {
  sm: { container: "px-4 py-2 rounded-lg",   text: "text-sm" },
  md: { container: "px-6 py-3 rounded-xl",   text: "text-base" },
  lg: { container: "px-8 py-4 rounded-2xl",  text: "text-lg" },
};

export function Button({
  title,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const variantStyle = variantClasses[variant];
  const sizeStyle = sizeClasses[size];

  return (
    <TouchableOpacity
      className={`
        ${variantStyle.container}
        ${sizeStyle.container}
        items-center justify-center
        ${disabled ? "opacity-50" : ""}
        ${className}
      `}
      disabled={disabled}
      activeOpacity={0.8}
      {...props}
    >
      <Text className={`${variantStyle.text} ${sizeStyle.text}`}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}
