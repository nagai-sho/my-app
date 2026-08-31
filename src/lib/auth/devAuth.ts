const DEV_LOGIN_STORAGE_KEY = 'dev-login';

export function isDevLoggedIn(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(DEV_LOGIN_STORAGE_KEY) === 'true';
}

export function validateDevCredentials(
  user: string,
  password: string,
  expectedUser: string,
  expectedPassword: string,
): boolean {
  return user.trim() === expectedUser && password === expectedPassword;
}

export function setDevLoggedIn(): void {
  window.localStorage.setItem(DEV_LOGIN_STORAGE_KEY, 'true');
}

export function clearDevLoggedIn(): void {
  window.localStorage.removeItem(DEV_LOGIN_STORAGE_KEY);
}
