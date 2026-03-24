import React from 'react';
import { Zone } from '../../engine/types';
import type { CardInstance } from '../../engine/types';
import { CardView } from './CardView';

interface ZoneDialogProps {
  playerName: string;
  zone: Zone.GRAVEYARD | Zone.EXILE;
  cards: CardInstance[];
  previewCardId: string | null;
  touchFriendly: boolean;
  onPreview: (card: CardInstance) => void;
  onPreviewClear: (cardId?: string) => void;
  onClose: () => void;
}

function getZoneTitle(zone: Zone.GRAVEYARD | Zone.EXILE): string {
  return zone === Zone.GRAVEYARD ? 'Graveyard' : 'Exile';
}

export const ZoneDialog: React.FC<ZoneDialogProps> = ({
  playerName,
  zone,
  cards,
  previewCardId,
  touchFriendly,
  onPreview,
  onPreviewClear,
  onClose,
}) => {
  const orderedCards = zone === Zone.GRAVEYARD ? [...cards].reverse() : cards;

  return (
    <div className="arena-zone-modal" onClick={onClose}>
      <div
        className="arena-zone-modal__panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${playerName} ${getZoneTitle(zone)}`}
      >
        <div className="arena-zone-modal__header">
          <div>
            <div className="arena-zone-modal__title">
              {playerName} {getZoneTitle(zone)}
            </div>
            <div className="arena-preview__meta">
              {orderedCards.length} card{orderedCards.length === 1 ? '' : 's'}
            </div>
          </div>

          <button className="arena-ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        {orderedCards.length === 0 ? (
          <div className="arena-preview__meta">No cards in this zone.</div>
        ) : (
          <div className="arena-zone-modal__grid">
            {orderedCards.map((card) => (
              <CardView
                key={card.objectId}
                card={card}
                variant="mini"
                onPreview={onPreview}
                onPreviewClear={onPreviewClear}
                isPreviewed={previewCardId === card.objectId}
                previewMode={touchFriendly ? 'tap' : 'hover'}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
