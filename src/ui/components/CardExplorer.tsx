import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import type { CardInstance } from '../../engine/types';
import { useCardArt } from '../hooks/useCardArt';
import { isTokenCard } from '../utils/gameView';

export type CardExplorerSelectionMode = 'single' | 'multi' | 'none';

export interface CardExplorerProps {
  title: string;
  cards: CardInstance[];
  selectionMode: CardExplorerSelectionMode;
  dismissable: boolean;
  onSelect?: (cards: CardInstance[]) => void;
  onClose: () => void;
  previewCardId: string | null;
  onPreview: (card: CardInstance) => void;
  onPreviewClear: (cardId?: string) => void;
}

function ExplorerCard({
  card,
  selected,
  selectable,
  isPreviewed,
  onClick,
  onPreview,
  onPreviewClear,
}: {
  card: CardInstance;
  selected: boolean;
  selectable: boolean;
  isPreviewed: boolean;
  onClick: () => void;
  onPreview: (card: CardInstance) => void;
  onPreviewClear: (cardId?: string) => void;
}) {
  const isFaceDown = card.faceDown;
  const art = useCardArt(card.definition.name, { enabled: !isTokenCard(card) && !isFaceDown });
  const imageUrl = isFaceDown ? undefined : (art.normal ?? art.png ?? art.artCrop);
  const displayName = isFaceDown ? 'Face-down card' : card.definition.name;

  return (
    <div
      className="arena-card-explorer__card"
      data-selected={selected}
      data-selectable={selectable}
      onClick={onClick}
    >
      <div
        className="arena-card"
        data-variant="hand"
        data-previewed={isPreviewed}
        title={displayName}
        style={
          {
            ['--card-cursor' as string]: selectable ? 'pointer' : 'default',
            ['--bare-card-image' as string]: imageUrl ? `url("${imageUrl}")` : 'none',
          } as React.CSSProperties
        }
        onMouseEnter={() => onPreview(card)}
        onMouseLeave={() => onPreviewClear(card.objectId)}
      />
    </div>
  );
}

export const CardExplorer: React.FC<CardExplorerProps> = ({
  title,
  cards,
  selectionMode,
  dismissable,
  onSelect,
  onClose,
  previewCardId,
  onPreview,
  onPreviewClear,
}) => {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredCards = useMemo(() => {
    if (!search.trim()) return cards;
    const query = search.toLowerCase();
    return cards.filter((card) => card.definition.name.toLowerCase().includes(query));
  }, [cards, search]);

  const handleCardClick = useCallback(
    (card: CardInstance) => {
      if (selectionMode === 'none') return;

      if (selectionMode === 'single') {
        onSelect?.([card]);
        return;
      }

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(card.objectId)) {
          next.delete(card.objectId);
        } else {
          next.add(card.objectId);
        }
        return next;
      });
    },
    [selectionMode, onSelect],
  );

  const handleConfirm = useCallback(() => {
    const selected = cards.filter((card) => selectedIds.has(card.objectId));
    onSelect?.(selected);
  }, [cards, selectedIds, onSelect]);

  const handleBackdropClick = useCallback(() => {
    if (dismissable) onClose();
  }, [dismissable, onClose]);

  useEffect(() => {
    if (!dismissable) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [dismissable, onClose]);

  return ReactDOM.createPortal(
    <div className="arena-zone-modal arena-card-explorer__overlay" onClick={handleBackdropClick}>
      <div
        className="arena-zone-modal__panel arena-card-explorer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="arena-zone-modal__header">
          <div>
            <div className="arena-zone-modal__title">{title}</div>
            <div className="arena-preview__meta">
              {filteredCards.length} card{filteredCards.length === 1 ? '' : 's'}
              {search && filteredCards.length !== cards.length && ` of ${cards.length}`}
            </div>
          </div>

          <div className="arena-card-explorer__actions">
            <input
              className="arena-card-explorer__search"
              type="text"
              placeholder="Search cards..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
            />
            {dismissable && (
              <button className="arena-ghost-button" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        </div>

        <div className="arena-card-explorer__grid">
          {filteredCards.map((card) => (
            <ExplorerCard
              key={card.objectId}
              card={card}
              selected={selectedIds.has(card.objectId)}
              selectable={selectionMode !== 'none'}
              isPreviewed={previewCardId === card.objectId}
              onClick={() => handleCardClick(card)}
              onPreview={onPreview}
              onPreviewClear={onPreviewClear}
            />
          ))}
        </div>

        {filteredCards.length === 0 && (
          <div className="arena-preview__meta" style={{ textAlign: 'center', padding: 24 }}>
            No cards match your search.
          </div>
        )}

        {selectionMode === 'multi' && (
          <div className="arena-card-explorer__footer">
            <span className="arena-preview__meta">
              {selectedIds.size} selected
            </span>
            <button
              className="arena-ghost-button"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
