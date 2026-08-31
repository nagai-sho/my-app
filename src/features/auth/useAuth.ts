import { useCallback, useEffect, useState } from 'react';

import { appConfig } from '../../lib/config';
import {
  clearDevLoggedIn,
  isDevLoggedIn,
  setDevLoggedIn,
  validateDevCredentials,
} from '../../lib/auth/devAuth';

interface AuthState {
  isAuthenticated: boolean;
  isCheckingSession: boolean;
  idToken: string | null;
  loginWithDevCredentials: (user: string, password: string) => boolean;
  loginWithGoogleToken: (token: string) => void;
  loginWithAdminCredentials: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [devAuthenticated, setDevAuthenticated] = useState(
    () => appConfig.enableDevLogin && isDevLoggedIn(),
  );
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const shouldCheckSession = appConfig.apiMode === 'real';
  const [isCheckingSession, setIsCheckingSession] = useState(shouldCheckSession);

  useEffect(() => {
    if (!shouldCheckSession) {
      return;
    }

    let cancelled = false;
    void fetch('/api/auth/session', { credentials: 'same-origin' })
      .then((response) => {
        if (!cancelled && response.ok) {
          setAdminAuthenticated(true);
        }
      })
      .catch(() => {
        // API未起動時はログイン画面を表示し、手動ログインを可能にする。
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldCheckSession]);

  const loginWithDevCredentials = useCallback((user: string, password: string) => {
    const valid = validateDevCredentials(
      user,
      password,
      appConfig.devUser,
      appConfig.devPassword,
    );

    if (valid) {
      setDevLoggedIn();
      setDevAuthenticated(true);
    }

    return valid;
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
    clearDevLoggedIn();
    setDevAuthenticated(false);
    setGoogleToken(null);
    setAdminAuthenticated(false);

    if (appConfig.apiMode === 'real') {
      void fetch('/api/auth/logout', {
        credentials: 'same-origin',
        method: 'POST',
      }).catch(() => {
        // ローカル状態は先に破棄し、API障害で画面に残らないようにする。
      });
    }
  }, []);

  return {
    isAuthenticated: devAuthenticated || adminAuthenticated || Boolean(googleToken),
    isCheckingSession,
    idToken: googleToken,
    loginWithDevCredentials,
    loginWithAdminCredentials,
    loginWithGoogleToken,
    logout,
  };
}
