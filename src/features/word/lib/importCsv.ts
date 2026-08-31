import { isCardStatus } from './cardStatus';
import type { CardStatus } from '../types';

export interface ImportRow {
  frontText: string;
  backText: string;
  directory: string;
  status?: CardStatus;
  lineNumber: number;
}

export interface ImportPreview {
  rows: ImportRow[];
  errors: string[];
}

export const CSV_TEMPLATE = '\uFEFFfront,back,directory,status,createdAt,updatedAt\napple,りんご,英単語,new,,\nrun,走る,英単語/動詞,learning,,\n';

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuote && nextChar === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuote = !inQuote;
      continue;
    }

    if (char === ',' && !inQuote) {
      cells.push(cell.trim());
      cell = '';
      continue;
    }

    cell += char;
  }

  cells.push(cell.trim());
  return cells;
}

function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase();
}

export function parseImportCsv(text: string): ImportPreview {
  const errors: string[] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { rows: [], errors: ['CSVが空です。'] };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const frontIndex = headers.findIndex((header) => ['front', 'fronttext', '表面'].includes(header));
  const backIndex = headers.findIndex((header) => ['back', 'backtext', '裏面'].includes(header));
  const directoryIndex = headers.findIndex((header) => ['directory', 'folder', 'ディレクトリ'].includes(header));
  const statusIndex = headers.findIndex((header) => ['status', 'ステータス'].includes(header));

  if (frontIndex < 0 || backIndex < 0) {
    return { rows: [], errors: ['ヘッダーに front と back が必要です。'] };
  }

  const rows = lines.slice(1).flatMap((line, index) => {
    const lineNumber = index + 2;
    const cells = parseCsvLine(line);
    const frontText = cells[frontIndex]?.trim() ?? '';
    const backText = cells[backIndex]?.trim() ?? '';
    const directory = directoryIndex >= 0 ? (cells[directoryIndex]?.trim() ?? '') : '';
    const statusValue = statusIndex >= 0 ? (cells[statusIndex]?.trim() ?? '') : '';

    if (!frontText || !backText) {
      errors.push(`${lineNumber}行目: front と back は必須です。`);
      return [];
    }

    if (statusValue && !isCardStatus(statusValue)) {
      errors.push(`${lineNumber}行目: status は new, learning, weak, reviewing, mastered のいずれかを指定してください。`);
      return [];
    }

    const status: CardStatus | undefined = isCardStatus(statusValue) ? statusValue : undefined;

    return [{ frontText, backText, directory, status, lineNumber }];
  });

  return { rows, errors };
}

export function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'word-app-import-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

