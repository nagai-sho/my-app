export interface App {
  id: string;
  name: string;
  url: string;
  description?: string;
  sortOrder: number;
  iconUrl?: string;
  pinned: boolean;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}
