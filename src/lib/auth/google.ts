const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
}

interface GoogleIdentity {
  initialize: (configuration: GoogleIdConfiguration) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme: 'outline';
      size: 'large';
      text: 'signin_with';
      shape: 'rectangular';
      width: number;
    },
  ) => void;
  cancel?: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentity;
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts.id) {
    return Promise.resolve();
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google認証スクリプトを読み込めませんでした。'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export async function renderGoogleButton(
  parent: HTMLElement,
  clientId: string,
  onCredential: (token: string) => void,
): Promise<() => void> {
  await loadGoogleIdentityScript();

  const googleId = window.google?.accounts.id;
  if (!googleId) {
    throw new Error('Google認証を初期化できませんでした。');
  }

  googleId.initialize({
    client_id: clientId,
    callback: (response) => onCredential(response.credential),
  });
  googleId.renderButton(parent, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    width: 280,
  });

  return () => googleId.cancel?.();
}
