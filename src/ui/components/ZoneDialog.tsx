import React from 'react';
import { Zone } from '../../engine/types';
import type { CardInstance } from '../../engine/types';
import { CardView } from './CardView';

interface ZoneSection {
  zone: typeof Zone.GRAVEYARD | typeof Zone.EXILE;
  cards: CardInstance[];
}

interface ZoneDialogProps {
  playerName: string;
  sections: ZoneSection[];
  previewCardId: string | null;
  touchFriendly: boolean;
  onPreview: (card: CardInstance) => void;
  onPreviewClear: (cardId?: string) => void;
  onClose: () => void;
}

function getZoneTitle(zone: typeof Zone.GRAVEYARD | typeof Zone.EXILE): string {
  return zone === Zone.GRAVEYARD ? 'Graveyard' : 'Exile';
}

export const ZoneDialog: React.FC<ZoneDialogProps> = ({
  playerName,
  sections,
  previewCardId,
  touchFriendly,
  onPreview,
  onPreviewClear,
  onClose,
}) => {
  const totalCards = sections.reduce((sum, s) => sum + s.cards.length, 0);
  const title = sections.map((s) => getZoneTitle(s.zone)).join(' & ');

  return (
    <div className="arena-zone-modal" onClick={onClose}>
      <div
        className="arena-zone-modal__panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${playerName} ${title}`}
      >
        <div className="arena-zone-modal__header">
          <div>
            <div className="arena-zone-modal__title">
              {playerName} {title}
            </div>
            <div className="arena-preview__meta">
              {totalCards} card{totalCards === 1 ? '' : 's'}
            </div>
          </div>

          <button className="arena-ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        {sections.map((section) => {
          const orderedCards =
            section.zone === Zone.GRAVEYARD ? [...section.cards].reverse() : section.cards;

          return (
            <div key={section.zone} className="arena-zone-modal__section">
              <div className="arena-zone-modal__section-label">
                {getZoneTitle(section.zone)} ({section.cards.length})
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
          );
        })}
      </div>
    </div>
  );
};
