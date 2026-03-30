import { Palette } from './Theme';

export const Colors = {
  light: {
    text:            Palette.body,
    background:      Palette.bg,
    tint:            Palette.primary,
    icon:            Palette.muted,
    tabIconDefault:  Palette.muted,
    tabIconSelected: Palette.primary,
  },
  dark: {
    text:            Palette.dark.body,
    background:      Palette.dark.bg,
    tint:            '#3D52E8',
    icon:            Palette.dark.muted,
    tabIconDefault:  Palette.dark.muted,
    tabIconSelected: '#3D52E8',
  },
};
