export type DocumentKind = 'image' | 'pdf';

export type StoredDocument = {
  id: string;
  owner_id: string;
  title: string;
  kind: DocumentKind;
  has_thumbnail: boolean;
  folder_path: string;
  page_count: number;
  bytes: number;
  mime: string;
  source_created_at: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type User = {
  email: string;
  name: string;
  picture?: string;
};

export type Folder = {
  id: string;
  owner_id: string;
  path: string;
  name: string;
  parent_path: string;
  manual_order_enabled: number;
  created_at: string;
  updated_at: string;
};
