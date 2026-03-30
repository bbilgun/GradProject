/**
 * Design System — MUST Academic App
 * Single source of truth for all design tokens.
 */

export const Palette = {
  // Brand
  primary:   '#08158F',   // Deep Blue — headers, buttons, active states
  gold:      '#FFC20D',   // Golden Yellow — sparingly: accents, badges
  error:     '#FF0000',   // Red — errors, critical alerts, delete only

  // Neutrals
  bg:        '#F8F9FA',   // App background
  card:      '#FFFFFF',   // Card surface
  border:    'rgba(8,21,143,0.10)',  // Card border
  divider:   'rgba(8,21,143,0.06)',

  // Typography
  heading:   '#08158F',   // All headings / labels
  body:      '#2D2D2D',   // Body text
  muted:     '#6B7280',   // Captions, placeholders
  disabled:  '#B0B7C3',

  // Dark mode equivalents
  dark: {
    bg:      '#0F1117',
    card:    '#1A1D2E',
    border:  'rgba(255,255,255,0.08)',
    divider: 'rgba(255,255,255,0.05)',
    heading: '#E8EAFF',
    body:    '#9AA0B4',
    muted:   '#5A6180',
  },
} as const;

/** Ease-Out-Expo Bezier — fast start, smooth deceleration */
export const EaseOutExpo = [0.19, 1, 0.22, 1] as const;

export const Radii = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  pill: 999,
} as const;

export const Space = {
  gutter: 20,
  cardPad: 16,
} as const;
