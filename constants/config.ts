import { Platform } from 'react-native';

/**
 * API base URL — iOS simulator uses localhost, Android emulator uses 10.0.2.2
 */
const API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8000'
    : 'http://localhost:8000';

export const Config = {
  API_BASE,
  SEARCH_ENDPOINT: `${API_BASE}/search`,
  SUMMARIZE_ENDPOINT: `${API_BASE}/summarize`,
  SYNC_ENDPOINT: `${API_BASE}/sync-web`,
} as const;
