import { Platform } from 'react-native';

/**
 * API base URL
 *  - iOS simulator    → localhost
 *  - Android emulator → 10.0.2.2
 *  - Physical device  → your Mac's LAN IP (set EXPO_PUBLIC_API_URL in .env)
 */
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

export const Config = {
  API_BASE,
  SEARCH_ENDPOINT:          `${API_BASE}/search`,
  SUMMARIZE_ENDPOINT:       `${API_BASE}/summarize`,
  SYNC_ENDPOINT:            `${API_BASE}/sync-web`,
  RESOURCES_ENDPOINT:       `${API_BASE}/resources`,
  RESOURCES_RECENT_ENDPOINT:`${API_BASE}/resources/recent`,
  CHAT_ENDPOINT:            `${API_BASE}/chat`,
  AUTH_LOGIN:               `${API_BASE}/auth/login`,
  AUTH_REGISTER:            `${API_BASE}/auth/register`,
  USERS_ME:                 `${API_BASE}/users/me`,
  NEWS:                     `${API_BASE}/news`,
  NEWS_POST:                `${API_BASE}/admin/news`,
} as const;
