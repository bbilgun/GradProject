# Setup

## Install dependencies

```bash
yarn install
```

## Add font asset

Download `SpaceMono-Regular.ttf` and place it at:
```
assets/fonts/SpaceMono-Regular.ttf
```
Or swap it for any font in `app/_layout.tsx`.

## Add image assets

Place the following in `assets/images/`:
- `icon.png` (1024×1024)
- `adaptive-icon.png` (1024×1024)
- `splash-icon.png` (200×200)
- `favicon.png` (64×64)

## Run

```bash
yarn ios       # iOS simulator
yarn android   # Android emulator
yarn web       # Web browser
```

## Project structure

```
app/
  _layout.tsx          # Root layout — imports global.css, sets up fonts
  (tabs)/
    _layout.tsx        # Tab navigator
    index.tsx          # Home tab
    explore.tsx        # Explore tab
  +not-found.tsx

components/
  ThemedText.tsx       # Text with dark-mode support
  ThemedView.tsx       # View with dark-mode support
  HapticTab.tsx        # Tab bar button with haptic feedback
  ui/
    Button.tsx         # Reusable button (variants: primary/secondary/outline/ghost)
    IconSymbol.tsx     # Cross-platform icon wrapper
    TabBarBackground.tsx

constants/
  Colors.ts            # Light/dark color tokens

hooks/
  useColorScheme.ts
  useThemeColor.ts     # Resolve color token by current scheme
  useAppState.ts       # AppState change listener

global.css             # Tailwind entry point
tailwind.config.js     # NativeWind/Tailwind config
babel.config.js
metro.config.js
```

## NativeWind usage

Use `className` on any React Native core component:

```tsx
<View className="flex-1 bg-primary-50 px-4 py-6">
  <Text className="text-xl font-bold text-secondary-900 dark:text-white">
    Hello
  </Text>
</View>
```

Dark mode classes (`dark:`) respond automatically to the system color scheme.
