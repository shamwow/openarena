import React from 'react';
import { CardType, type CardInstance, type PlayerAction, type Zone } from '../../engine/types';
import { useCardArt } from '../hooks/useCardArt';
import type { DragCardPayload } from '../types';
import { getPrimaryCardAction, isTokenCard } from '../utils/gameView';

interface CardViewProps {
  card: CardInstance;
  legalActions?: PlayerAction[];
  onAction?: (action: PlayerAction) => void;
  onPreview?: (card: CardInstance) => void;
  onPreviewClear?: (cardId?: string) => void;
  variant?: 'battlefield' | 'hand' | 'mini' | 'flight';
  isPreviewed?: boolean;
  previewMode?: 'hover' | 'tap';
  scale?: number;
  lift?: number;
  mountRef?: (node: HTMLDivElement | null) => void;
  draggableAction?: PlayerAction | null;
  onDragStart?: (payload: DragCardPayload) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  sourceZone?: Zone;
}

function formatCounterLabel(counterType: string, amount: number): string {
  if (counterType === '+1/+1' || counterType === '-1/-1') {
    return `${counterType} x${amount}`;
  }

  return `${counterType} ${amount}`;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  legalActions = [],
  onAction,
  onPreview,
  onPreviewClear,
  variant = 'battlefield',
  isPreviewed = false,
  previewMode = 'hover',
  scale = 1,
  lift = 0,
  mountRef,
  draggableAction = null,
  onDragStart,
  onDragEnd,
  isDragging = false,
  sourceZone,
}) => {
  const art = useCardArt(card.definition.name, {
    enabled: !isTokenCard(card),
  });
  const interactionAction = getPrimaryCardAction(card, legalActions);
  const imageUrl = art.normal ?? art.png ?? art.artCrop;
  const hasAction = interactionAction != null;
  const resolvedSourceZone = sourceZone ?? card.zone;
  const isBattlefieldCard = variant === 'battlefield';
  const counterEntries = Object.entries(card.counters).filter(([, amount]) => amount > 0);
  const hasCreatureStats = card.definition.types.includes(CardType.CREATURE);
  const power = card.modifiedPower ?? card.definition.power;
  const toughness = card.modifiedToughness ?? card.definition.toughness;
  const loyalty =
    card.counters.loyalty ??
    (card.definition.loyalty != null ? card.definition.loyalty : undefined);
  const battlefieldBadges = [
    ...(card.markedDamage > 0 ? [`Damage ${card.markedDamage}`] : []),
    ...(card.summoningSick && hasCreatureStats ? ['Summoning sick'] : []),
    ...counterEntries
      .filter(([counterType]) => counterType !== 'loyalty')
      .map(([counterType, amount]) => formatCounterLabel(counterType, amount)),
  ];
  const battlefieldStats = hasCreatureStats && power != null && toughness != null
    ? `${power}/${toughness}`
    : loyalty != null
      ? `Loyalty ${loyalty}`
      : null;

  const handlePreview = () => {
    onPreview?.(card);
  };

  const handlePreviewClear = () => {
    onPreviewClear?.(card.objectId);
  };

  const handleActivate = () => {
    if (previewMode === 'tap' && !isPreviewed) {
      handlePreview();
      return;
    }

    if (interactionAction && onAction) {
      onAction(interactionAction);
      return;
    }

    handlePreview();
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (!draggableAction || !onDragStart) {
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', card.objectId);

    onDragStart({
      card,
      action: draggableAction,
      playerId: draggableAction.playerId,
      sourceZone: resolvedSourceZone,
      hiddenSource: false,
    });
  };
  return (
    <div
      ref={mountRef}
      className="arena-card"
      data-variant={variant}
      data-has-action={hasAction}
      data-previewed={isPreviewed}
      data-selected={previewMode === 'tap' && isPreviewed}
      data-tapped={card.tapped}
      data-dragging={isDragging}
      data-source-zone={resolvedSourceZone}
      draggable={draggableAction != null && onDragStart != null && variant !== 'flight'}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={previewMode === 'hover' ? handlePreview : undefined}
      onMouseLeave={previewMode === 'hover' ? handlePreviewClear : undefined}
      onFocus={handlePreview}
      onBlur={previewMode === 'hover' ? handlePreviewClear : undefined}
      onClick={variant === 'flight' ? undefined : handleActivate}
      title={card.definition.name}
      style={
        {
          ['--card-scale' as string]: `${scale}`,
          ['--card-lift' as string]: `${lift}px`,
          ['--card-cursor' as string]:
            hasAction || onPreview ? 'pointer' : 'default',
        } as React.CSSProperties
      }
    >
      <div className="arena-card__frame">
        <div className="arena-card__image-wrap">
          {imageUrl ? (
            <img
              className="arena-card__image"
              alt={card.definition.name}
              src={imageUrl}
              loading={variant === 'hand' ? 'eager' : 'lazy'}
            />
          ) : (
            <div className="arena-card__placeholder">
              <div className="arena-card__placeholder-label">
                {card.definition.name}
              </div>
            </div>
          )}
        </div>
        {isBattlefieldCard && battlefieldBadges.length > 0 ? (
          <div className="arena-card__badges">
            {battlefieldBadges.map((badge) => (
              <span key={badge} className="arena-card__badge">
                {badge}
              </span>
            ))}
          </div>
        ) : null}
        {isBattlefieldCard && battlefieldStats ? (
          <div className="arena-card__stats">
            {battlefieldStats}
          </div>
        ) : null}
      </div>
    </div>
  );
};
