/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_DEV_LOGIN?: string;
  readonly VITE_DEV_USER?: string;
  readonly VITE_DEV_PASSWORD?: string;
  readonly VITE_API_MODE?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
