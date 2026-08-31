import { useEffect, useState } from 'react';
import { CARD_STATUS_LABELS, CARD_STATUSES, DEFAULT_CARD_STATUS } from '../lib/cardStatus';
import { getFolderSelectOptions } from '../lib/folders';
import type { Card, CardStatus, Folder } from '../types';

interface CardFormProps {
  folders: Folder[];
  card?: Card;
  selectedFolderId: string;
  onSubmit: (input: { frontText: string; backText: string; folderId: string; status?: CardStatus }, id?: string) => Promise<unknown>;
  onCancel?: () => void;
  showFolderSelect?: boolean;
  showStatusSelect?: boolean;
  showSuccessMessage?: boolean;
}

export function CardForm({
  folders,
  card,
  selectedFolderId,
  onSubmit,
  onCancel,
  showFolderSelect = true,
  showStatusSelect = Boolean(card),
  showSuccessMessage = false,
}: CardFormProps) {
  const [frontText, setFrontText] = useState(card?.frontText ?? '');
  const [backText, setBackText] = useState(card?.backText ?? '');
  const [folderId, setFolderId] = useState(card?.folderId ?? selectedFolderId);
  const [status, setStatus] = useState<CardStatus>(card?.status ?? DEFAULT_CARD_STATUS);
  const [message, setMessage] = useState('');
  const showBackInput = Boolean(card) || frontText.trim().length > 0;

  useEffect(() => {
    if (!card) setFolderId(selectedFolderId);
  }, [card, selectedFolderId]);

  useEffect(() => {
    if (card) {
      setFrontText(card.frontText);
      setBackText(card.backText);
      setFolderId(card.folderId);
      setStatus(card.status);
      return;
    }

    setFrontText('');
    setBackText('');
    setStatus(DEFAULT_CARD_STATUS);
  }, [card]);

  return (
    <form
      className={`card-form ${showBackInput ? '' : 'card-form-front-only'}`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!frontText.trim() || !backText.trim()) return;
        const input = card ? { frontText, backText, folderId, status } : { frontText, backText, folderId };
        setMessage('');
        void onSubmit(input, card?.id).then((result) => {
          if (typeof result === 'object' && result !== null && 'duplicate' in result) {
            setMessage('同じ表面のワードがすでに登録されています。');
            return;
          }
          if (!card) {
            setFrontText('');
            setBackText('');
            setStatus(DEFAULT_CARD_STATUS);
          }
          if (showSuccessMessage) setMessage(card ? '更新しました。' : '登録しました。');
        });
      }}
    >
      <label>
        表面
        <textarea value={frontText} onChange={(event) => setFrontText(event.target.value)} rows={3} required />
      </label>
      {showBackInput && (
        <>
          <label>
            裏面
            <textarea value={backText} onChange={(event) => setBackText(event.target.value)} rows={3} required />
          </label>
          {showFolderSelect && (
            <label>
              ディレクトリ
              <select value={folderId} onChange={(event) => setFolderId(event.target.value)}>
                {getFolderSelectOptions(folders).map(({ folder, label }) => (
                  <option key={folder.id} value={folder.id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {showStatusSelect && (
            <label>
              ステータス
              <select value={status} onChange={(event) => setStatus(event.target.value as CardStatus)}>
                {CARD_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {CARD_STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="form-actions">
            {onCancel && (
              <button type="button" className="secondary" onClick={onCancel}>
                戻る
              </button>
            )}
            <button type="submit">{card ? '更新' : '登録'}</button>
          </div>
          {message && <p className="form-message">{message}</p>}
        </>
      )}
      {!showBackInput && onCancel && (
        <div className="form-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            戻る
          </button>
        </div>
      )}
    </form>
  );
}

