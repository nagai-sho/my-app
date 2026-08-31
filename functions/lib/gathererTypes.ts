import type { AppEnv } from './env';

export type GathererEnv = AppEnv;

export type GathererProvider = 'rss' | 'json_api' | 'github_releases' | 'html' | 'tavily';

export type GathererSourceRow = {
  id: string;
  owner_id: string;
  provider: GathererProvider;
  endpoint: string;
  title: string;
  enabled: number;
  created_at: number;
  updated_at: number;
};

export type GathererRuleRow = {
  id: string;
  source_id: string;
  include_keywords: string;
  exclude_keywords: string;
  regex: string | null;
  tags: string;
  created_at: number;
  updated_at: number;
};

export type GathererItemInput = {
  external_id: string;
  title: string;
  url: string;
  summary: string;
  published_at: number | null;
};

export type GathererRule = GathererRuleRow & {
  include: string[];
  exclude: string[];
  tagsArray: string[];
};

export type GathererCollectResult = {
  runId: string;
  inserted: number;
  reused: number;
  skipped: number;
  status: 'success' | 'partial' | 'fail';
  failures: string[];
};
