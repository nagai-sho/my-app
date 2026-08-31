import { useState } from 'react';
import { normalizeWord } from '../lib/duplicates';
import { getFolderName } from '../lib/folders';
import { downloadCsvTemplate, parseImportCsv, type ImportPreview } from '../lib/importCsv';
import { ROOT_FOLDER_ID, rootFolder } from '../lib/sampleData';
import type { Card, CardStatus, Folder } from '../types';

interface CsvImportPanelProps {
  folders: Folder[];
  cards: Card[];
  currentFolderId: string;
  onCreateFolder: (name: string, parentId: string | null) => Promise<unknown>;
  onCreateCard: (input: { frontText: string; backText: string; folderId: string; status?: CardStatus }, id?: string) => Promise<unknown>;
  onImportComplete?: (message: string) => void;
}

function isFolder(value: unknown): value is Folder {
  return typeof value === 'object' && value !== null && 'id' in value && 'name' in value && 'parentId' in value;
}

export function CsvImportPanel({ folders, cards, currentFolderId, onCreateFolder, onCreateCard, onImportComplete }: CsvImportPanelProps) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  const handleFile = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(parseImportCsv(String(reader.result ?? '')));
      setMessage('');
    };
    reader.readAsText(file);
  };

  const resolveFolderId = async (directory: string, knownFolders: Folder[]) => {
    if (!directory.trim()) return currentFolderId;

    let parentId: string | null = null;
    let folderId = ROOT_FOLDER_ID;
    const names = directory.split('/').map((name) => name.trim()).filter(Boolean);

    for (const name of names) {
      const existing = knownFolders.find((folder) => folder.name === name && (folder.parentId ?? ROOT_FOLDER_ID) === (parentId ?? ROOT_FOLDER_ID));
      if (existing) {
        folderId = existing.id;
        parentId = existing.id;
        continue;
      }

      const created = await onCreateFolder(name, parentId);
      if (!isFolder(created)) throw new Error(`${name} を作成できませんでした。`);
      knownFolders.push(created);
      folderId = created.id;
      parentId = created.id;
    }

    return folderId;
  };

  const importRows = async () => {
    if (!preview || preview.rows.length === 0 || preview.errors.length > 0) return;
    setImporting(true);
    setMessage('');

    try {
      const knownFolders = [...folders];
      const knownWords = new Set(cards.map((card) => normalizeWord(card.frontText)));
      const skippedWords: string[] = [];
      let createdCount = 0;
      for (const row of preview.rows) {
        const normalizedWord = normalizeWord(row.frontText);
        if (knownWords.has(normalizedWord)) {
          skippedWords.push(row.frontText);
          continue;
        }
        const folderId = await resolveFolderId(row.directory, knownFolders);
        await onCreateCard({ frontText: row.frontText, backText: row.backText, folderId, status: row.status });
        knownWords.add(normalizedWord);
        createdCount += 1;
      }
      const completeMessage = `${createdCount}件を登録しました。${skippedWords.length > 0 ? `重複 ${skippedWords.length}件はスキップしました: ${skippedWords.join('、')}` : ''}`;
      setMessage(completeMessage);
      onImportComplete?.(completeMessage);
      setPreview(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '取り込みに失敗しました。');
    } finally {
      setImporting(false);
    }
  };

  return (
    <section className="panel import-panel">
      <div className="panel-header">
        <h2>CSV一括登録</h2>
        <button type="button" className="secondary" onClick={downloadCsvTemplate}>
          テンプレート
        </button>
      </div>
      <label className="file-picker">
        <span>CSVファイル</span>
        <input type="file" accept=".csv,text/csv" onChange={(event) => handleFile(event.target.files?.[0])} />
      </label>
      {preview && (
        <div className="import-preview">
          <div className="import-status">
            <strong>{preview.rows.length}件</strong>
            {preview.errors.length > 0 && <span>{preview.errors.length}件のエラー</span>}
            {preview.rows.some((row, index) => (
              cards.some((card) => normalizeWord(card.frontText) === normalizeWord(row.frontText))
              || preview.rows.findIndex((item) => normalizeWord(item.frontText) === normalizeWord(row.frontText)) < index
            )) && <span>重複あり</span>}
          </div>
          {preview.rows.length > 0 && (
            <DuplicateImportWords rows={preview.rows} cards={cards} />
          )}
          {preview.errors.length > 0 && (
            <ul className="import-errors">
              {preview.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          {preview.rows.length > 0 && (
            <div className="import-table">
              {preview.rows.slice(0, 5).map((row) => (
                <div key={row.lineNumber}>
                  <span>{row.frontText}</span>
                  <span>{row.backText}</span>
                  <span>{row.directory || getFolderName(folders.find((folder) => folder.id === currentFolderId) ?? rootFolder)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="form-actions">
            <button type="button" disabled={importing || preview.errors.length > 0 || preview.rows.length === 0} onClick={() => void importRows()}>
              {importing ? '取り込み中' : '取り込む'}
            </button>
          </div>
        </div>
      )}
      {message && <p className="import-message">{message}</p>}
    </section>
  );
}

function DuplicateImportWords({ rows, cards }: { rows: ImportPreview['rows']; cards: Card[] }) {
  const existingWords = new Set(cards.map((card) => normalizeWord(card.frontText)));
  const seenWords = new Set<string>();
  const duplicateWords = rows.flatMap((row) => {
    const normalizedWord = normalizeWord(row.frontText);
    const isDuplicate = existingWords.has(normalizedWord) || seenWords.has(normalizedWord);
    seenWords.add(normalizedWord);
    return isDuplicate ? [row.frontText] : [];
  });

  if (duplicateWords.length === 0) return null;

  return (
    <div className="duplicate-words" aria-label="取り込み重複ワード">
      <strong>登録しない重複ワード</strong>
      <span>{duplicateWords.join('、')}</span>
    </div>
  );
}

