export interface AppEnv extends Env {
  GOOGLE_CLIENT_ID?: string;
  ALLOWED_GOOGLE_EMAILS?: string;
  BYPASS_AUTH?: string;
  RUNTIME_ENV?: string;
  USER_NAME?: string;
  PASSWORD?: string;
}
