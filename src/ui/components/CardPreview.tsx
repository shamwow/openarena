import React from 'react';
import { CardType, emptyManaCost } from '../../engine/types';
import { useCardArt } from '../hooks/useCardArt';
import type { PreviewCardState } from '../types';
import { ManaCostView } from './ManaCostView';

interface CardPreviewProps {
  preview: PreviewCardState;
}

function getTypeLine(preview: PreviewCardState): string {
  const { card } = preview;
  if (card.faceDown) {
    return 'Face-down card';
  }
  const left = [...card.definition.supertypes, ...card.definition.types].join(' ');
  if (card.definition.subtypes.length === 0) {
    return left;
  }
  return `${left} - ${card.definition.subtypes.join(' ')}`;
}

function getCardStats(preview: PreviewCardState): string | null {
  const { card } = preview;
  if (card.faceDown) {
    return null;
  }
  if (card.definition.types.includes(CardType.CREATURE)) {
    return `${card.modifiedPower ?? card.definition.power}/${card.modifiedToughness ?? card.definition.toughness}`;
  }
  if (card.definition.loyalty != null) {
    return `Loyalty ${card.counters.loyalty ?? card.definition.loyalty}`;
  }
  return null;
}

function getAbilityText(preview: PreviewCardState): string[] {
  if (preview.card.faceDown) {
    return [];
  }
  const abilities = preview.card.modifiedAbilities ?? preview.card.definition.abilities;
  return Array.from(
    new Set(
      abilities
        .map((ability) => ability.description.trim())
        .filter((description) => description.length > 0),
    ),
  );
}

export const CardPreview: React.FC<CardPreviewProps> = ({ preview }) => {
  const isFaceDown = preview.card.faceDown;
  const art = useCardArt(preview.card.definition.name, {
    enabled: !preview.card.definition.id.startsWith('token-') && !isFaceDown,
  });

  const stats = getCardStats(preview);
  const abilityText = getAbilityText(preview);
  const imageUrl = isFaceDown ? undefined : (art.large ?? art.normal ?? art.png);
  const displayName = isFaceDown ? 'Face-down card' : preview.card.definition.name;

  return (
    <aside className="arena-preview">
      <div className="arena-preview__header">
        <div>
          <h2 className="arena-preview__title">{displayName}</h2>
          <div className="arena-preview__meta">
            Controlled by {preview.controllerName} · Owned by {preview.ownerName}
          </div>
        </div>
        {!isFaceDown && <ManaCostView cost={preview.card.definition.cost?.mana ?? emptyManaCost()} />}
      </div>

      <div className="arena-preview__art">
        {imageUrl ? (
          <img alt={displayName} src={imageUrl} loading="eager" />
        ) : (
          <div className="arena-card__placeholder" />
        )}
      </div>

      <div className="arena-preview__body">
        <div className="arena-preview__type">{getTypeLine(preview)}</div>
        {abilityText.length > 0 && (
          <div className="arena-preview__meta">
            {abilityText.join(', ')}
          </div>
        )}
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
