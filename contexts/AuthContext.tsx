/**
 * AuthContext — JWT token + user state across the app.
 *
 * Persistence: token stored in AsyncStorage under key 'auth_token'.
 * On cold launch the context restores the token and re-fetches /users/me
 * to verify it is still valid before marking the user as logged in.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Config } from "@/constants/config";

// ── Types ─────────────────────────────────────────────────────────

export interface UserProfile {
  id: number;
  student_id: string;
  email: string;
  full_name: string | null;
  major: string | null;
  gpa: number | null;
  total_credits: number | null;
  role: "student" | "admin" | "student_council";
  admission_year: string;
  class_code: string;
  index: string;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  /** true while the context is restoring the session from AsyncStorage */
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (studentId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ── AsyncStorage helper (safe when native module not yet linked) ───

const STORAGE_KEY = "auth_token";

async function readToken(): Promise<string | null> {
  try {
    const mod = require("@react-native-async-storage/async-storage");
    const storage = mod.default ?? mod;
    return (await storage.getItem(STORAGE_KEY)) ?? null;
  } catch {
    return null;
  }
}

async function writeToken(token: string): Promise<void> {
  try {
    const mod = require("@react-native-async-storage/async-storage");
    const storage = mod.default ?? mod;
    await storage.setItem(STORAGE_KEY, token);
  } catch {}
}

async function removeToken(): Promise<void> {
  try {
    const mod = require("@react-native-async-storage/async-storage");
    const storage = mod.default ?? mod;
    await storage.removeItem(STORAGE_KEY);
  } catch {}
}

// ── Context ───────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    loading: true,
  });

  // ── Restore session on mount ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      const savedToken = await readToken();
      if (!savedToken) {
        setState({ token: null, user: null, loading: false });
        return;
      }
      // Verify token is still valid by fetching the profile
      try {
        const res = await fetch(Config.USERS_ME, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });
        if (res.ok) {
          const user: UserProfile = await res.json();
          setState({ token: savedToken, user, loading: false });
        } else {
          // Token expired or revoked
          await removeToken();
          setState({ token: null, user: null, loading: false });
        }
      } catch {
        // Network error — keep token but no user (will re-auth on next request)
        setState({ token: savedToken, user: null, loading: false });
      }
    })();
  }, []);

  // ── Login ────────────────────────────────────────────────────────
  const login = useCallback(async (studentId: string, password: string) => {
    const res = await fetch(Config.AUTH_LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: studentId, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail ?? "Нэвтрэхэд алдаа гарлаа.");
    }

    const { access_token } = await res.json();
    await writeToken(access_token);

    // Fetch full profile immediately
    const meRes = await fetch(Config.USERS_ME, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) throw new Error("Хэрэглэгчийн мэдээлэл авахад алдаа гарлаа.");
    const user: UserProfile = await meRes.json();

    setState({ token: access_token, user, loading: false });
  }, []);

  // ── Logout ───────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await removeToken();
    setState({ token: null, user: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
