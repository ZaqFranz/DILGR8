import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setAuthToken } from "@/shared/api/apiClient";
import { login as loginApi, register as registerApi } from "@/features/auth/api/authApi";
import type { AuthUser } from "@/features/auth/types";

const STORAGE_KEY = "dilgr8rsp.auth";

interface StoredAuth {
  accessToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True until the stored session (if any) has been read from localStorage. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredAuth();
    if (stored) {
      setAuthToken(stored.accessToken);
      setUser(stored.user);
    }
    setIsLoading(false);
  }, []);

  function persist(auth: StoredAuth) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    setAuthToken(auth.accessToken);
    setUser(auth.user);
  }

  async function login(email: string, password: string) {
    const result = await loginApi({ email, password });
    persist(result);
  }

  async function register(email: string, password: string) {
    const result = await registerApi({ email, password });
    persist(result);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, isLoading, login, register, logout }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
