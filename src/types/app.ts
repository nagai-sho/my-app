export type AppCategory = 'integrated' | 'external';

export interface App {
  id: string;
  name: string;
  url: string;
  description?: string;
  category: AppCategory;
  sortOrder: number;
  iconUrl?: string;
  pinned: boolean;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}
