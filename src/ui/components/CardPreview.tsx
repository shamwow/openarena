import React from 'react';
import { CardType } from '../../engine/types';
import { useCardArt } from '../hooks/useCardArt';
import type { PreviewCardState } from '../types';
import { ManaCostView } from './ManaCostView';

interface CardPreviewProps {
  preview: PreviewCardState;
}

function getTypeLine(preview: PreviewCardState): string {
  const { card } = preview;
  const left = [...card.definition.supertypes, ...card.definition.types].join(' ');
  if (card.definition.subtypes.length === 0) {
    return left;
  }
  return `${left} - ${card.definition.subtypes.join(' ')}`;
}

function getCardStats(preview: PreviewCardState): string | null {
  const { card } = preview;
  if (card.definition.types.includes(CardType.CREATURE)) {
    return `${card.modifiedPower ?? card.definition.power}/${card.modifiedToughness ?? card.definition.toughness}`;
  }
  if (card.definition.loyalty != null) {
    return `Loyalty ${card.counters.loyalty ?? card.definition.loyalty}`;
  }
  return null;
}

export const CardPreview: React.FC<CardPreviewProps> = ({ preview }) => {
  const art = useCardArt(preview.card.definition.name, {
    enabled: !preview.hidden && !preview.card.definition.id.startsWith('token-'),
  });

  const stats = getCardStats(preview);
  const imageUrl = art.large ?? art.normal ?? art.png;

  if (preview.hidden) {
    return (
      <aside className="arena-preview" data-hidden="true">
        <div className="arena-preview__header">
          <div>
            <h2 className="arena-preview__title">Hidden Card</h2>
            <div className="arena-preview__meta">
              Controlled by {preview.controllerName} · Owned by {preview.ownerName}
            </div>
          </div>
        </div>

        <div className="arena-preview__art arena-preview__art--concealed">
          <div className="arena-card-back" aria-hidden="true" />
        </div>

        <div className="arena-preview__body">
          <div className="arena-preview__type">In hidden hand</div>
          <div className="arena-preview__oracle">Card details are hidden until revealed.</div>
          <div className="arena-preview__footer">
            <div className="arena-preview__meta">Seat {preview.seat}</div>
            <span />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="arena-preview">
      <div className="arena-preview__header">
        <div>
          <h2 className="arena-preview__title">{preview.card.definition.name}</h2>
          <div className="arena-preview__meta">
            Controlled by {preview.controllerName} · Owned by {preview.ownerName}
          </div>
        </div>
        <ManaCostView cost={preview.card.definition.manaCost} />
      </div>

      <div className="arena-preview__art">
        {imageUrl ? (
          <img alt={preview.card.definition.name} src={imageUrl} loading="eager" />
        ) : (
          <div className="arena-card__placeholder" />
        )}
      </div>

      <div className="arena-preview__body">
        <div className="arena-preview__type">{getTypeLine(preview)}</div>
        {preview.card.definition.keywords.length > 0 && (
          <div className="arena-preview__meta">
            {preview.card.definition.keywords.join(', ')}
          </div>
        )}
        <div className="arena-preview__oracle">
          {preview.card.definition.oracleText || 'No rules text'}
        </div>
        <div className="arena-preview__footer">
          <div className="arena-preview__meta">
            {preview.card.tapped ? 'Tapped' : 'Untapped'}
            {preview.card.summoningSick ? ' · Summoning sick' : ''}
          </div>
          {stats ? <div className="arena-card__stats">{stats}</div> : <span />}
        </div>
      </div>
    </aside>
  );
};
