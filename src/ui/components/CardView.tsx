import React from 'react';
import type { CardInstance, PlayerAction, Zone } from '../../engine/types';
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
            <div className="arena-card__placeholder" />
          )}
        </div>
      </div>
    </div>
  );
};
