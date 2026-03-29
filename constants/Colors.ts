/**
 * Central color palette for light/dark theming.
 * These tokens are used by ThemedText, ThemedView, and navigation.
 */
const palette = {
  primary: "#0ea5e9",
  white:   "#ffffff",
  black:   "#0c0a09",
};

export const Colors = {
  light: {
    text:       "#1c1917",
    background: "#ffffff",
    tint:       palette.primary,
    icon:       "#78716c",
    tabIconDefault:  "#78716c",
    tabIconSelected: palette.primary,
  },
  dark: {
    text:       "#fafaf9",
    background: "#1c1917",
    tint:       "#38bdf8",
    icon:       "#a8a29e",
    tabIconDefault:  "#a8a29e",
    tabIconSelected: "#38bdf8",
  },
};
