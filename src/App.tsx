import { useCallback, useState } from 'react';

import { AppGrid } from './components/AppGrid';
import { AppHeader } from './components/AppHeader';
import { LoginPage } from './components/LoginPage';
import { SkeletonGrid } from './components/SkeletonGrid';
import { StatusState } from './components/StatusState';
import { useAuth } from './features/auth/useAuth';
import { useApps } from './features/apps/useApps';
import { appConfig } from './lib/config';
import styles from './App.module.css';

function Dashboard({ idToken, onLogout }: { idToken: string | null; onLogout: () => void }): JSX.Element {
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const { apps, error, isLoading, retry } = useApps(appConfig.apiMode, idToken);

  return (
    <div className={styles.appShell}>
      <div className={styles.dashboard}>
        <AppHeader
          openInNewTab={openInNewTab}
          onToggleNewTab={() => setOpenInNewTab((current) => !current)}
          onLogout={onLogout}
        />
        <div className={styles.searchSpacer} aria-hidden="true" />
        <main className={styles.main} aria-labelledby="apps-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.sectionKicker}>YOUR WORKSPACE</p>
              <h2 id="apps-heading" className={styles.sectionTitle}>アプリ一覧</h2>
            </div>
            {!isLoading && !error && apps.length > 0 && (
              <span className={styles.count}>{apps.length} apps</span>
            )}
          </div>
          {isLoading && <SkeletonGrid count={8} />}
          {!isLoading && error && (
            <StatusState
              kind="error"
              message="読み込みに失敗しました。再読み込みしてください。"
              onRetry={retry}
            />
          )}
          {!isLoading && !error && apps.length === 0 && (
            <StatusState kind="empty" message="まだアプリが登録されていません" />
          )}
          {!isLoading && !error && apps.length > 0 && (
            <AppGrid apps={apps} openInNewTab={openInNewTab} />
          )}
        </main>
        <footer className={styles.footer}>自分専用のアプリランチャー</footer>
      </div>
    </div>
  );
}

export default function App(): JSX.Element {
  const auth = useAuth();
  const {
    loginWithAdminCredentials,
    loginWithGoogleToken,
  } = auth;
  const handleGoogleLogin = useCallback(
    (token: string) => loginWithGoogleToken(token),
    [loginWithGoogleToken],
  );
  const handleAdminLogin = useCallback(
    (username: string, password: string) => loginWithAdminCredentials(username, password),
    [loginWithAdminCredentials],
  );

  if (auth.isCheckingSession) {
    return (
      <main className={styles.authLoading} aria-live="polite">
        認証状態を確認しています…
      </main>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <LoginPage
        enableDevLogin={appConfig.enableDevLogin}
        onAdminLogin={handleAdminLogin}
        onDevLogin={auth.loginWithDevCredentials}
        onGoogleLogin={handleGoogleLogin}
        showAdminLogin={!appConfig.enableDevLogin || appConfig.apiMode === 'real'}
      />
    );
  }

  return <Dashboard idToken={auth.idToken} onLogout={auth.logout} />;
}
