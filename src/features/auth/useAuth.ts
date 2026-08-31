import { useCallback, useEffect, useState } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  isCheckingSession: boolean;
  idToken: string | null;
  loginWithGoogleToken: (token: string) => void;
  loginWithAdminCredentials: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [googleToken, setGoogleToken] = useState<string | null>(null);
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

  const loginWithGoogleToken = useCallback((token: string) => {
    setGoogleToken(token);
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
    setGoogleToken(null);
    setAdminAuthenticated(false);
    void fetch('/api/auth/logout', {
      credentials: 'same-origin',
      method: 'POST',
    }).catch(() => {
      // ローカル状態は先に破棄し、API障害で画面に残らないようにする。
    });
  }, []);

  return {
    isAuthenticated: adminAuthenticated || Boolean(googleToken),
    isCheckingSession,
    idToken: googleToken,
    loginWithAdminCredentials,
    loginWithGoogleToken,
    logout,
  };
}
