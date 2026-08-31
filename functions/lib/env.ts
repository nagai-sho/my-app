import type { D1Database } from '@cloudflare/workers-types';

export interface AppEnv extends Env {
  /** The single D1 binding shared by all integrated features. */
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ALLOWED_GOOGLE_EMAILS?: string;
  OWNER_GOOGLE_EMAIL?: string;
  USER_NAME?: string;
  PASSWORD?: string;
  TAVILY_API_KEY?: string;
  TAVILY_DAILY_CREDIT_LIMIT?: string;
  TAVILY_MONTHLY_CREDIT_LIMIT?: string;
}
