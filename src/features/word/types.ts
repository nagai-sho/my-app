export type SpeechLanguage = 'ja-JP' | 'en-US';
export type CardStatus = 'new' | 'learning' | 'weak' | 'reviewing' | 'mastered';

export interface Card {
  id: string;
  frontText: string;
  backText: string;
  folderId: string;
  status: CardStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export interface SpeechSettings {
  language: SpeechLanguage;
  voiceName?: string;
  rate?: number;
}

