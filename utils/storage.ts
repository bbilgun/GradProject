/**
 * Onboarding state.
 *
 * Uses a module-level flag for instant synchronous reads (no blank screens,
 * no native module dependency). The flag resets when the JS bundle reloads,
 * so onboarding appears on every cold launch / reload — perfect for dev.
 *
 * For production persistence, call persistSeen() which writes to AsyncStorage
 * when the native module is available (requires npx expo run:ios rebuild).
 */

let _seen = false;

/** Synchronous — safe to call during render */
export function isOnboardingSeen(): boolean {
  return _seen;
}

/** Call when the user completes or permanently dismisses onboarding */
export function markOnboardingSeen(): void {
  _seen = true;

  // Best-effort persist to native storage (no-op if module not yet linked)
  try {
    const mod = require('@react-native-async-storage/async-storage');
    const storage = mod.default ?? mod;
    if (typeof storage?.setItem === 'function') {
      storage.setItem('onboarding_seen', 'true').catch(() => {});
    }
  } catch {}
}
