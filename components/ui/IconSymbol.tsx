import MaterialIcons from "@expo/vector-icons/MaterialIcons";
type SymbolWeight = 'ultraLight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black';
import { OpaqueColorValue, StyleProp, ViewStyle } from "react-native";

// Map SF Symbol names used in navigation to MaterialIcons equivalents (cross-platform)
const MAPPING: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  "house.fill":       "home",
  "paperplane.fill":  "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right":    "chevron-right",
};

export type IconSymbolName = keyof typeof MAPPING;

type Props = {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
};

export function IconSymbol({ name, size = 24, color, style }: Props) {
  return (
    <MaterialIcons
      color={color}
      size={size}
      name={MAPPING[name]}
      style={style as any}
    />
  );
}
