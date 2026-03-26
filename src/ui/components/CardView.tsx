import React from 'react';
import type { CardInstance, PlayerAction, Zone } from '../../engine/types';
import { CardType } from '../../engine/types';
import { useCardArt } from '../hooks/useCardArt';
import type { DragCardPayload } from '../types';
import { getPrimaryCardAction, isTokenCard } from '../utils/gameView';
import { ManaCostView } from './ManaCostView';

interface CardViewProps {
  card: CardInstance;
  legalActions?: PlayerAction[];
  onAction?: (action: PlayerAction) => void;
  onPreview?: (card: CardInstance) => void;
  onPreviewClear?: (cardId?: string) => void;
  variant?: 'battlefield' | 'hand' | 'mini' | 'flight';
  isPreviewed?: boolean;
  previewMode?: 'hover' | 'tap';
  scale?: number | string;
  lift?: number | string;
  mountRef?: (node: HTMLDivElement | null) => void;
  draggableAction?: PlayerAction | null;
  onDragStart?: (payload: DragCardPayload) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  sourceZone?: Zone;
}

function getTypeLine(card: CardInstance): string {
  const left = [...card.definition.supertypes, ...card.definition.types].join(' ');
  if (card.definition.subtypes.length === 0) {
    return left;
  }
  return `${left} - ${card.definition.subtypes.join(' ')}`;
}

function getStats(card: CardInstance): string | null {
  if (card.definition.types.includes(CardType.CREATURE)) {
    return `${card.modifiedPower ?? card.definition.power}/${card.modifiedToughness ?? card.definition.toughness}`;
  }
  if (card.definition.loyalty != null) {
    return `L${card.counters.loyalty ?? card.definition.loyalty}`;
  }
  return null;
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
  const stats = getStats(card);
  const counterEntries = Object.entries(card.counters).filter(([, count]) => count > 0);
  const resolvedSourceZone = sourceZone ?? card.zone;

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

  const oracleSnippet = card.definition.oracleText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[0];
  const resolvedScale = typeof scale === 'number' ? `${scale}` : scale;
  const resolvedLift = typeof lift === 'number' ? `${lift}px` : lift;

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
          ['--card-scale' as string]: resolvedScale,
          ['--card-lift' as string]: resolvedLift,
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
            <div className="arena-card__placeholder" />
          )}
        </div>
        <div className="arena-card__surface" />

        <div className="arena-card__chrome">
          <div className="arena-card__name">{card.definition.name}</div>
          {variant !== 'mini' && <ManaCostView cost={card.definition.manaCost} />}
        </div>

        <div className="arena-card__status-stack">
          {card.markedDamage > 0 && (
            <span className="arena-card__badge" data-kind="damage">
              {card.markedDamage} dmg
            </span>
          )}
          {card.summoningSick && card.definition.types.includes(CardType.CREATURE) && (
            <span className="arena-card__badge" data-kind="sick">
              summoning
            </span>
          )}
          {card.tapped && (
            <span className="arena-card__badge" data-kind="tap">
              tapped
            </span>
          )}
          {counterEntries.map(([counterType, count]) => (
            <span key={counterType} className="arena-card__badge" data-kind="counter">
              {count} {counterType}
            </span>
          ))}
        </div>

        <div className="arena-card__footer">
          <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
            <div className="arena-card__type">{getTypeLine(card)}</div>
            {variant !== 'mini' && oracleSnippet ? (
              <div className="arena-card__text-chip">{oracleSnippet}</div>
            ) : null}
          </div>
          {stats ? <div className="arena-card__stats">{stats}</div> : null}
        </div>
      </div>
    </div>
  );
};
