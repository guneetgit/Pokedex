import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import Constants from "expo-constants";
import { getAccessToken, saveTokens, clearTokens } from "../utils/tokenStorage";
import { refreshSession } from "../api/client";

// Refresh 1 minute before the 5-minute token expiry
const AUTO_REFRESH_INTERVAL_MS = 30 * 1000; // 30 seconds

// Dynamically grabs your Mac's IP address so your phone can connect automatically!
// Hardcoding home IP because Constants.expoConfig might not resolve correctly
const API_URL = `http://192.168.29.199:3002/auth`;

type AuthContextType = {
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  signup: (phone: string, password: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  isLoggedIn: false,
  isLoading: true,
  signup: async () => {},
  verifyOtp: async () => {},
  login: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ─── 1. Load token on app start ───────────────────────────────────────────
  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await getAccessToken();
        if (storedToken) {
          setToken(storedToken);
        }
      } catch (e) {
        console.error("Failed to load token", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadToken();
  }, []);

  // ─── 2. Auto-refresh while app is in the foreground ───────────────────────
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Keep a ref in sync with the latest token so the interval can read it
  // without being listed as a dependency (avoids restart on every refresh)
  const tokenRef = useRef<string | null>(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const stopRefreshInterval = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
      console.log("Auto-refresh paused (app went to background).");
    }
  }, []);

  const startRefreshInterval = useCallback(() => {
    // Clear any existing interval before starting a new one
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);

    console.log("Auto-refresh started. Will refresh token every 30 seconds.");
    refreshIntervalRef.current = setInterval(async () => {
      // Read from ref — does NOT trigger effect re-run
      if (!tokenRef.current) return;
      console.log("30 seconds passed - proactively refreshing token...");
      try {
        const newToken = await refreshSession();
        if (newToken) {
          tokenRef.current = newToken; // update ref immediately
          setToken(newToken);          // update state for UI
        }
      } catch (e) {
        console.error("Auto-refresh failed. Logging out.", e);
        tokenRef.current = null;
        setToken(null);
      }
    }, AUTO_REFRESH_INTERVAL_MS);
  }, []);

  // Runs ONCE on mount — stable interval, no restart on token change
  useEffect(() => {
    // Start interval only if already logged in on mount
    if (tokenRef.current) {
      startRefreshInterval();
    }

    // Listen for AppState changes (foreground <-> background)
    const subscription = AppState.addEventListener(
      "change",
      async (nextState: AppStateStatus) => {
        const previousState = appStateRef.current;
        appStateRef.current = nextState;

        if (nextState === "active") {
          // App came to foreground
          if (!tokenRef.current) return; // not logged in, skip
          console.log("App is now active - refreshing token immediately.");
          try {
            const newToken = await refreshSession();
            if (newToken) {
              tokenRef.current = newToken;
              setToken(newToken);
            }
          } catch (e) {
            tokenRef.current = null;
            setToken(null);
          }
          startRefreshInterval(); // Reset the 4-min countdown
        } else if (previousState === "active" && nextState === "background") {
          // App went to background — pause the interval to save battery
          stopRefreshInterval();
        }
      },
    );

    // Cleanup: only runs on component unmount (e.g. full app close)
    return () => {
      stopRefreshInterval();
      subscription.remove();
      console.log("Auto-refresh cleanup done.");
    };
  }, []); // ← empty deps: runs once, never restarts due to token changes

  // Start/stop interval reactively when login/logout happens at runtime
  useEffect(() => {
    if (token) {
      startRefreshInterval();
    } else {
      stopRefreshInterval();
    }
  }, [token === null]); // only re-runs when going logged-in ↔ logged-out

  const signup = async (phone: string, password: string) => {
    const res = await fetch(`${API_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Signup failed");
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const res = await fetch(`${API_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "OTP Verification failed");
  };

  const login = async (phone: string, password: string) => {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");

    setToken(data.token);
    // Assuming backend also returns data.refreshToken
    await saveTokens(data.token, data.refreshToken);
  };

  const logout = async () => {
    try {
      setToken(null);
      await clearTokens();
    } catch (e) {
      console.error("Failed to logout", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isLoggedIn: !!token,
        isLoading,
        signup,
        verifyOtp,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
