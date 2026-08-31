import { useEffect, useRef, useState } from 'react';

import { renderGoogleButton } from '../lib/auth/google';
import { appConfig } from '../lib/config';
import styles from './LoginPage.module.css';

interface LoginPageProps {
  enableDevLogin: boolean;
  onDevLogin: (user: string, password: string) => boolean;
  onGoogleLogin: (token: string) => void;
}

function DevLoginForm({ onDevLogin }: Pick<LoginPageProps, 'onDevLogin'>): JSX.Element {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onDevLogin(user, password)) {
      return;
    }
    setError('ユーザー名またはパスワードが正しくありません。');
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.label} htmlFor="dev-user">
        ユーザー名
      </label>
      <input
        id="dev-user"
        className={styles.input}
        type="email"
        autoComplete="username"
        value={user}
        onChange={(event) => setUser(event.target.value)}
        required
      />
      <label className={styles.label} htmlFor="dev-password">
        パスワード
      </label>
      <input
        id="dev-password"
        className={styles.input}
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" className={styles.submitButton}>
        ログイン
      </button>
      <p className={styles.hint}>ローカル確認用: admin@example.com / password</p>
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

export function LoginPage({
  enableDevLogin,
  onDevLogin,
  onGoogleLogin,
}: LoginPageProps): JSX.Element {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <div className={styles.brandMark} aria-hidden="true">m</div>
        <p className={styles.eyebrow}>PERSONAL APP LAUNCHER</p>
        <h1 id="login-title" className={styles.title}>my-app</h1>
        <p className={styles.subtitle}>登録したアプリへ、すばやくアクセス。</p>
        {enableDevLogin ? (
          <DevLoginForm onDevLogin={onDevLogin} />
        ) : (
          <GoogleLogin onGoogleLogin={onGoogleLogin} />
        )}
      </section>
    </main>
  );
}
