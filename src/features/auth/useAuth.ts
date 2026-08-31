import { useCallback, useState } from 'react';

import { appConfig } from '../../lib/config';
import {
  clearDevLoggedIn,
  isDevLoggedIn,
  setDevLoggedIn,
  validateDevCredentials,
} from '../../lib/auth/devAuth';

interface AuthState {
  isAuthenticated: boolean;
  idToken: string | null;
  loginWithDevCredentials: (user: string, password: string) => boolean;
  loginWithGoogleToken: (token: string) => void;
  logout: () => void;
}

export function useAuth(): AuthState {
  const [devAuthenticated, setDevAuthenticated] = useState(
    () => appConfig.enableDevLogin && isDevLoggedIn(),
  );
  const [googleToken, setGoogleToken] = useState<string | null>(null);

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

  const logout = useCallback(() => {
    clearDevLoggedIn();
    setDevAuthenticated(false);
    setGoogleToken(null);
  }, []);

  return {
    isAuthenticated: appConfig.enableDevLogin ? devAuthenticated : Boolean(googleToken),
    idToken: appConfig.enableDevLogin ? null : googleToken,
    loginWithDevCredentials,
    loginWithGoogleToken,
    logout,
  };
}
