import { useEffect, useRef, useState } from 'react';

import { renderGoogleButton } from '../lib/auth/google';
import { appConfig } from '../lib/config';
import styles from './LoginPage.module.css';

interface LoginPageProps {
  onAdminLogin: (username: string, password: string) => Promise<boolean>;
  onGoogleLogin: (token: string) => void;
}

function AdminLoginForm({
  onAdminLogin,
}: Pick<LoginPageProps, 'onAdminLogin'>): JSX.Element {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const authenticated = await onAdminLogin(username, password);
    if (!authenticated) {
      setError('管理者のユーザー名またはパスワードが正しくありません。');
    }
    setIsSubmitting(false);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.label} htmlFor="admin-user">
        管理者ユーザー名
      </label>
      <input
        id="admin-user"
        className={styles.input}
        type="text"
        autoComplete="username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        required
      />
      <label className={styles.label} htmlFor="admin-password">
        管理者パスワード
      </label>
      <input
        id="admin-password"
        className={styles.input}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button
        type="submit"
        className={styles.submitButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? '確認中…' : '管理者としてログイン'}
      </button>
    </form>
  );
}

function GoogleLogin({ onGoogleLogin }: Pick<LoginPageProps, 'onGoogleLogin'>): JSX.Element {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    if (!appConfig.googleClientId) {
      setError('Google Client IDが設定されていません。');
      return;
    }

    if (!buttonRef.current) {
      return;
    }

    void renderGoogleButton(buttonRef.current, appConfig.googleClientId, (token) => {
      if (!disposed) {
        onGoogleLogin(token);
      }
    })
      .then((dispose) => {
        if (disposed) {
          dispose();
          return;
        }
        cleanup = dispose;
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          setError(cause instanceof Error ? cause.message : 'Google認証を初期化できませんでした。');
        }
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [onGoogleLogin]);

  return (
    <div className={styles.googleLogin}>
      <div ref={buttonRef} />
      {!error && <p className={styles.loading}>Google認証を準備しています…</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </div>
  );
}

export function LoginPage({ onAdminLogin, onGoogleLogin }: LoginPageProps): JSX.Element {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <div className={styles.brandMark} aria-hidden="true">m</div>
        <p className={styles.eyebrow}>PERSONAL APP LAUNCHER</p>
        <h1 id="login-title" className={styles.title}>my-app</h1>
        <p className={styles.subtitle}>登録したアプリへ、すばやくアクセス。</p>
        <GoogleLogin onGoogleLogin={onGoogleLogin} />
        <div className={styles.adminLogin}>
          <div className={styles.divider}>
            <span>または</span>
          </div>
          <p className={styles.adminTitle}>管理者ログイン</p>
          <AdminLoginForm onAdminLogin={onAdminLogin} />
        </div>
      </section>
    </main>
  );
}
