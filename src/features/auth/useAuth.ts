import { useCallback, useEffect, useState } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  isCheckingSession: boolean;
  idToken: string | null;
  loginWithGoogleToken: (token: string) => Promise<boolean>;
  loginWithAdminCredentials: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((response) => {
        if (!cancelled && response.ok) {
          setAdminAuthenticated(true);
        }
      })
      .catch(() => {
        // API未起動時は未認証としてログイン画面を表示する。
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithGoogleToken = useCallback(async (credential: string) => {
    try {
      const response = await fetch('/api/auth/google', {
        body: JSON.stringify({ credential }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) return false;
      setAdminAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const loginWithAdminCredentials = useCallback(
    async (username: string, password: string) => {
      try {
        const response = await fetch('/api/auth/login', {
          body: JSON.stringify({ password, username }),
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });

        if (!response.ok) {
          return false;
        }

        setAdminAuthenticated(true);
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setAdminAuthenticated(false);
    void fetch('/api/auth/logout', {
      credentials: 'same-origin',
      method: 'POST',
    }).catch(() => {
      // ローカル状態は先に破棄し、API障害で画面に残らないようにする。
    });
  }, []);

  return {
    isAuthenticated: adminAuthenticated,
    isCheckingSession,
    // API access is authenticated with the shared HttpOnly session cookie.
    idToken: null,
    loginWithAdminCredentials,
    loginWithGoogleToken,
    logout,
  };
}
