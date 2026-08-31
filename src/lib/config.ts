export const appConfig = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
} as const;

export async function loadGoogleClientId(): Promise<string> {
  try {
    const response = await fetch('/api/auth/config', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (response.ok) {
      const body: unknown = await response.json();
      if (
        body
        && typeof body === 'object'
        && 'googleClientId' in body
        && typeof body.googleClientId === 'string'
      ) {
        const clientId = body.googleClientId.trim();
        if (clientId) return clientId;
      }
    }
  } catch {
    // Vite-only local development can still use the build-time fallback.
  }
  return appConfig.googleClientId;
}
