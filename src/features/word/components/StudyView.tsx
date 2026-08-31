import { useState } from 'react';
import { useSwipe } from '../hooks/useSwipe';
import { CARD_STATUS_LABELS, CARD_STATUSES } from '../lib/cardStatus';
import { getFolderName, getFolderSelectOptions } from '../lib/folders';
import { rootFolder } from '../lib/sampleData';
import type { Card, CardStatus, Folder, SpeechLanguage } from '../types';

interface StudyCardProps {
  card: Card;
  folders: Folder[];
  flipped: boolean;
  offsetX: number;
  dragging: boolean;
  onFlip: () => void;
  onChangeFolder: (card: Card, folderId: string) => void;
  onChangeStatus: (card: Card, status: CardStatus) => void;
  swipeHandlers: ReturnType<typeof useSwipe>['handlers'];
}

function StudyCard({ card, folders, flipped, offsetX, dragging, onFlip, onChangeFolder, onChangeStatus, swipeHandlers }: StudyCardProps) {
  const folderName = getFolderName(folders.find((folder) => folder.id === card.folderId) ?? rootFolder);
  return (
    <div
      className={`study-card-frame ${dragging ? 'dragging' : ''}`}
      onClick={onFlip}
      {...swipeHandlers}
      style={{ transform: `translateX(${offsetX}px) rotate(${offsetX / 28}deg)` }}
    >
      <select
        className="folder-badge badge-select"
        value={card.folderId}
        aria-label="カードのディレクトリ"
        title={folderName}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          event.stopPropagation();
          onChangeFolder(card, event.currentTarget.value);
        }}
      >
        {getFolderSelectOptions(folders).map(({ folder }) => (
          <option key={folder.id} value={folder.id}>
            {getFolderName(folder)}
          </option>
        ))}
      </select>
      <select
        className={`status-badge status-badge-${card.status} badge-select`}
        value={card.status}
        aria-label="カードのステータス"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => {
          event.stopPropagation();
          onChangeStatus(card, event.currentTarget.value as CardStatus);
        }}
      >
        {CARD_STATUSES.map((status) => (
          <option key={status} value={status}>
            {CARD_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
      <button
        className={`study-card ${flipped ? 'flipped' : ''}`}
        type="button"
        aria-pressed={flipped}
      >
        <span className="card-face card-front">{card.frontText}</span>
        <span className="card-face card-back">{card.backText}</span>
      </button>
    </div>
  );
}

interface StudyViewProps {
  cards: Card[];
  folders: Folder[];
  language: SpeechLanguage;
  setLanguage: (language: SpeechLanguage) => void;
  speak: (text: string) => void;
  speaking: boolean;
  onChangeFolder: (card: Card, folderId: string) => void;
  onChangeStatus: (card: Card, status: CardStatus) => void;
}

export function StudyView({ cards, folders, language, setLanguage, speak, speaking, onChangeFolder, onChangeStatus }: StudyViewProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const visibleIndex = cards.length === 0 ? 0 : Math.min(index, cards.length - 1);
  const current = cards[visibleIndex];
  const goNext = () => {
    setFlipped(false);
    setIndex((value) => (cards.length === 0 ? 0 : (Math.min(value, cards.length - 1) + 1) % cards.length));
  };
  const goPrevious = () => {
    setFlipped(false);
    setIndex((value) => (cards.length === 0 ? 0 : (Math.min(value, cards.length - 1) - 1 + cards.length) % cards.length));
  };
  const seekTo = (value: number) => {
    setFlipped(false);
    setIndex(value - 1);
  };
  const swipe = useSwipe(goNext, goPrevious);

  if (!current) {
    return <section className="empty">カードを登録するとここに表示されます。</section>;
  }

  return (
    <section className="study">
      <div className="counter">
        {visibleIndex + 1} / {cards.length}
      </div>
      <StudyCard
        key={current.id}
        card={current}
        folders={folders}
        flipped={flipped}
        offsetX={swipe.offsetX}
        dragging={swipe.dragging}
        onFlip={() => setFlipped((value) => !value)}
        onChangeFolder={onChangeFolder}
        onChangeStatus={onChangeStatus}
        swipeHandlers={swipe.handlers}
      />
      <div className="study-actions">
        <button type="button" onClick={goPrevious} aria-label="前のカード">
          ←
        </button>
        <button type="button" onClick={() => speak(flipped ? current.backText : current.frontText)}>
          {speaking ? '再生中' : '音読'}
        </button>
        <button type="button" onClick={() => setLanguage(language === 'ja-JP' ? 'en-US' : 'ja-JP')}>
          {language}
        </button>
        <button type="button" onClick={goNext} aria-label="次のカード">
          →
        </button>
      </div>
      <label className="study-seek" onPointerDown={(event) => event.stopPropagation()}>
        カード位置
        <input
          type="range"
          min="1"
          max={cards.length}
          step="1"
          value={visibleIndex + 1}
          aria-valuetext={`${visibleIndex + 1}枚目 / ${cards.length}枚`}
          onChange={(event) => seekTo(Number(event.currentTarget.value))}
        />
      </label>
    </section>
  );
}
