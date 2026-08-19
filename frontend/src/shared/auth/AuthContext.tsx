import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthToken, setSessionExpiredHandler } from "@/shared/api/apiClient";
import { login as loginApi, register as registerApi } from "@/features/auth/api/authApi";
import type { AuthUser } from "@/features/auth/types";
import { getMyProfile } from "@/features/applicant-registration/api/applicantsApi";
import { useToast } from "@/shared/components/ToastProvider";

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
  /**
   * Whether this applicant has finished every registration step. Always
   * true for admins. Null while unknown (session restoring, or right after
   * login/register before the applicant profile has been fetched) - callers
   * that gate on this should treat null the same as isLoading.
   */
  registrationComplete: boolean | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Re-checks registration status; call after finishing the registration flow. */
  refreshRegistrationStatus: () => Promise<void>;
  /** Call after a successful password change to clear the forced-change gate. */
  clearMustChangePassword: () => void;
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
  const [registrationComplete, setRegistrationComplete] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

  async function syncRegistrationStatus(u: AuthUser) {
    if (u.role !== "APPLICANT") {
      setRegistrationComplete(true);
      return;
    }
    setRegistrationComplete(null);
    try {
      const profile = await getMyProfile();
      setRegistrationComplete(Boolean(profile?.registrationCompletedAt));
    } catch {
      setRegistrationComplete(false);
    }
  }

  useEffect(() => {
    const stored = readStoredAuth();
    if (stored) {
      setAuthToken(stored.accessToken);
      setUser(stored.user);
      void syncRegistrationStatus(stored.user);
    }
    setIsLoading(false);
  }, []);

  function persist(auth: StoredAuth) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    setAuthToken(auth.accessToken);
    setUser(auth.user);
    void syncRegistrationStatus(auth.user);
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
    setRegistrationComplete(null);
  }

  // Any authenticated request that comes back 401 means this session's
  // token is dead (expired or invalidated) - drop it and bounce to /login
  // instead of leaving the user stranded on a page that can't load data.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      logout();
      toast.info("Your session has expired. Please log in again.");
      navigate("/login", { replace: true });
    });
    return () => setSessionExpiredHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, toast]);

  async function refreshRegistrationStatus() {
    if (user) {
      await syncRegistrationStatus(user);
    }
  }

  // No GET /me endpoint exists to re-fetch this from - the backend clears
  // mustChangePassword the moment the password-change call succeeds, so the
  // frontend just mirrors that locally rather than adding a round trip.
  function clearMustChangePassword() {
    if (!user) return;
    const updated = { ...user, mustChangePassword: false };
    setUser(updated);
    const stored = readStoredAuth();
    if (stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, user: updated }));
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      registrationComplete,
      login,
      register,
      logout,
      refreshRegistrationStatus,
      clearMustChangePassword,
    }),
    [user, isLoading, registrationComplete],
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
