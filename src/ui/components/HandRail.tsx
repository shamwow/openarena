import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CardInstance, PlayerAction, PlayerId } from '../../engine/types';
import { ActionType, Zone } from '../../engine/types';
import { useCardArt } from '../hooks/useCardArt';
import type { DragCardPayload } from '../types';
import { getPrimaryCardAction, isTokenCard } from '../utils/gameView';

const MAX_VISIBLE = 15;
const MAX_PILE_SHOW = 4;

interface HandRailProps {
  playerId: PlayerId;
  playerName: string;
  handHidden: boolean;
  command: CardInstance[];
  hand: CardInstance[];
  exile: CardInstance[];
  graveyard: CardInstance[];
  legalActions: PlayerAction[];
  previewCardId: string | null;
  previewMode: 'hover' | 'tap';
  draggingCardId: string | null;
  onAction: (action: PlayerAction) => void;
  onPreview: (card: CardInstance) => void;
  onPreviewClear: (cardId?: string) => void;
  onDragStart: (payload: DragCardPayload) => void;
  onDragEnd: () => void;
  registerCardElement: (cardId: string, node: HTMLDivElement | null) => void;
  registerZoneAnchor: (key: string, node: HTMLElement | null) => void;
}

type RailAnchorZone = typeof Zone.COMMAND | typeof Zone.EXILE | typeof Zone.GRAVEYARD;

type HandRailItem =
  | {
      kind: 'card';
      card: CardInstance;
      railIndex: number;
    }
  | {
      kind: 'hidden-hand';
      key: string;
      railIndex: number;
    };

function isRailAnchorZone(zone: Zone): zone is RailAnchorZone {
  return zone === Zone.COMMAND || zone === Zone.EXILE || zone === Zone.GRAVEYARD;
}

function cardsContainCardId(cards: CardInstance[], cardId: string | null): boolean {
  return cardId != null && cards.some((card) => card.objectId === cardId);
}

function railContainsCardId(
  command: CardInstance[],
  hand: CardInstance[],
  exile: CardInstance[],
  graveyard: CardInstance[],
  cardId: string | null,
): boolean {
  return (
    cardsContainCardId(command, cardId) ||
    cardsContainCardId(hand, cardId) ||
    cardsContainCardId(exile, cardId) ||
    cardsContainCardId(graveyard, cardId)
  );
}

function handRailPropsEqual(prev: HandRailProps, next: HandRailProps): boolean {
  if (
    prev.playerId !== next.playerId ||
    prev.playerName !== next.playerName ||
    prev.handHidden !== next.handHidden ||
    prev.command !== next.command ||
    prev.hand !== next.hand ||
    prev.exile !== next.exile ||
    prev.graveyard !== next.graveyard ||
    prev.legalActions !== next.legalActions ||
    prev.previewMode !== next.previewMode ||
    prev.onAction !== next.onAction ||
    prev.onPreview !== next.onPreview ||
    prev.onPreviewClear !== next.onPreviewClear ||
    prev.onDragStart !== next.onDragStart ||
    prev.onDragEnd !== next.onDragEnd ||
    prev.registerCardElement !== next.registerCardElement ||
    prev.registerZoneAnchor !== next.registerZoneAnchor
  ) {
    return false;
  }

  const previewRelevant =
    railContainsCardId(prev.command, prev.hand, prev.exile, prev.graveyard, prev.previewCardId) ||
    railContainsCardId(next.command, next.hand, next.exile, next.graveyard, next.previewCardId);
  if (previewRelevant && prev.previewCardId !== next.previewCardId) {
    return false;
  }

  const draggingRelevant =
    railContainsCardId(
      prev.command,
      prev.hand,
      prev.exile,
      prev.graveyard,
      prev.draggingCardId,
    ) ||
    railContainsCardId(
      next.command,
      next.hand,
      next.exile,
      next.graveyard,
      next.draggingCardId,
    );
  if (draggingRelevant && prev.draggingCardId !== next.draggingCardId) {
    return false;
  }

  return true;
}

function collectPlayableCardIds(legalActions: PlayerAction[]): Set<string> {
  const playableCardIds = new Set<string>();

  for (const action of legalActions) {
    if (
      (action.type === ActionType.CAST_SPELL || action.type === ActionType.PLAY_LAND) &&
      'cardId' in action
    ) {
      playableCardIds.add(action.cardId);
    }
  }

  return playableCardIds;
}

function buildHandRailItems(
  playerId: PlayerId,
  handHidden: boolean,
  command: CardInstance[],
  hand: CardInstance[],
  exile: CardInstance[],
  graveyard: CardInstance[],
  legalActions: PlayerAction[],
): HandRailItem[] {
  const playableCardIds = collectPlayableCardIds(legalActions);
  type HandRailItemSeed =
    | { kind: 'card'; card: CardInstance }
    | { kind: 'hidden-hand'; key: string };

  const orderedItems: HandRailItemSeed[] = [
    ...command.map((card) => ({ kind: 'card' as const, card })),
    ...(handHidden
      ? hand.map((_, handIndex) => ({
          kind: 'hidden-hand' as const,
          key: `hidden-hand-${playerId}-${handIndex}`,
        }))
      : hand.map((card) => ({ kind: 'card' as const, card }))),
    ...exile
      .filter((card) => playableCardIds.has(card.objectId))
      .map((card) => ({ kind: 'card' as const, card })),
    ...graveyard
      .filter((card) => playableCardIds.has(card.objectId))
      .map((card) => ({ kind: 'card' as const, card })),
  ];

  return orderedItems.map((item, railIndex) => {
    if (item.kind === 'card') {
      return { kind: 'card', card: item.card, railIndex };
    }
    return { kind: 'hidden-hand', key: item.key, railIndex };
  });
}

type CardPlacement = 'visible' | 'pile-left' | 'pile-right';

function getCardPlacement(
  railIndex: number,
  scrollIndex: number,
  totalCards: number,
  needsScroll: boolean,
): { placement: CardPlacement; visibleIndex: number; pileDistance: number } {
  if (!needsScroll) {
    return { placement: 'visible', visibleIndex: railIndex, pileDistance: 0 };
  }

  if (railIndex < scrollIndex) {
    const distance = scrollIndex - railIndex;
    return { placement: 'pile-left', visibleIndex: 0, pileDistance: distance };
  }

  if (railIndex >= scrollIndex + MAX_VISIBLE) {
    const distance = railIndex - scrollIndex - MAX_VISIBLE + 1;
    return { placement: 'pile-right', visibleIndex: 0, pileDistance: distance };
  }

  return {
    placement: 'visible',
    visibleIndex: railIndex - scrollIndex,
    pileDistance: 0,
  };
}

function getCardPositionStyle(
  placement: CardPlacement,
  visibleIndex: number,
  pileDistance: number,
  visibleCount: number,
): React.CSSProperties {
  const pileOffset = 'var(--hand-pile-offset, 3px)';
  const step = 'var(--hand-card-step)';

  switch (placement) {
    case 'visible':
      return {
        left: visibleIndex === 0
          ? '0px'
          : `calc(${visibleIndex} * ${step})`,
        zIndex: visibleIndex + MAX_PILE_SHOW + 1,
      };

    case 'pile-left': {
      const clamped = Math.min(pileDistance, MAX_PILE_SHOW);
      return {
        left: `calc(${-clamped} * ${pileOffset})`,
        zIndex: Math.max(1, MAX_PILE_SHOW - clamped + 1),
      };
    }

    case 'pile-right': {
      const clamped = Math.min(pileDistance, MAX_PILE_SHOW);
      return {
        left: `calc(${visibleCount - 1} * ${step} + ${clamped - 1} * ${pileOffset})`,
        zIndex: visibleCount + MAX_PILE_SHOW + clamped,
      };
    }
  }
}

interface HandRailCardProps {
  card: CardInstance;
  legalActions: PlayerAction[];
  onAction: (action: PlayerAction) => void;
  onPreview: (card: CardInstance) => void;
  onPreviewClear: (cardId?: string) => void;
  isPreviewed: boolean;
  previewMode: 'hover' | 'tap';
  draggingCardId: string | null;
  onDragStart: (payload: DragCardPayload) => void;
  onDragEnd: () => void;
  mountRef?: (node: HTMLDivElement | null) => void;
  sourceZone?: Zone;
}

function handRailCardPropsEqual(
  prev: HandRailCardProps,
  next: HandRailCardProps,
): boolean {
  return (
    prev.card === next.card &&
    prev.legalActions === next.legalActions &&
    prev.onAction === next.onAction &&
    prev.onPreview === next.onPreview &&
    prev.onPreviewClear === next.onPreviewClear &&
    prev.isPreviewed === next.isPreviewed &&
    prev.previewMode === next.previewMode &&
    prev.draggingCardId === next.draggingCardId &&
    prev.onDragStart === next.onDragStart &&
    prev.onDragEnd === next.onDragEnd &&
    prev.sourceZone === next.sourceZone
  );
}

const HandRailCard = React.memo<HandRailCardProps>(
  ({
    card,
    legalActions,
    onAction,
    onPreview,
    onPreviewClear,
    isPreviewed,
    previewMode,
    draggingCardId,
    onDragStart,
    onDragEnd,
    mountRef,
    sourceZone,
  }) => {
    const art = useCardArt(card.definition.name, {
      enabled: !isTokenCard(card),
    });
    const imageUrl = art.normal ?? art.png ?? art.artCrop;
    const interactionAction = getPrimaryCardAction(card, legalActions);
    const isDragging = draggingCardId === card.objectId;
    const resolvedSourceZone = sourceZone ?? card.zone;

    const handlePreview = () => {
      onPreview(card);
    };

    const handlePreviewClear = () => {
      onPreviewClear(card.objectId);
    };

    const handleActivate = () => {
      if (previewMode === 'tap' && !isPreviewed) {
        handlePreview();
        return;
      }

      if (interactionAction) {
        onAction(interactionAction);
        return;
      }

      handlePreview();
    };

    const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
      if (!interactionAction) {
        return;
      }

      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.objectId);

      onDragStart({
        card,
        action: interactionAction,
        playerId: interactionAction.playerId,
        sourceZone: resolvedSourceZone,
        hiddenSource: false,
      });
    };

    return (
      <div
        ref={mountRef}
        className="arena-card"
        data-variant="hand"

        data-previewed={isPreviewed}
        data-selected={previewMode === 'tap' && isPreviewed}
        data-has-action={interactionAction != null}
        data-dragging={isDragging}
        data-source-zone={resolvedSourceZone}
        draggable={interactionAction != null}
        title={card.definition.name}
        style={
          {
            ['--card-cursor' as string]: 'pointer',
            ['--bare-card-image' as string]: imageUrl ? `url("${imageUrl}")` : 'none',
          } as React.CSSProperties
        }
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        onMouseEnter={previewMode === 'hover' ? handlePreview : undefined}
        onMouseLeave={previewMode === 'hover' ? handlePreviewClear : undefined}
        onFocus={handlePreview}
        onBlur={previewMode === 'hover' ? handlePreviewClear : undefined}
        onClick={handleActivate}
      />
    );
  },
  handRailCardPropsEqual,
);

function HandScrollbar({
  scrollIndex,
  maxScrollIndex,
  visibleCount,
  totalCount,
  onChange,
}: {
  scrollIndex: number;
  maxScrollIndex: number;
  visibleCount: number;
  totalCount: number;
  onChange: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRatio = visibleCount / totalCount;
  const thumbLeft =
    maxScrollIndex > 0 ? (scrollIndex / maxScrollIndex) * (1 - thumbRatio) * 100 : 0;

  const handleTrackClick = (event: React.MouseEvent) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    onChange(Math.max(0, Math.min(maxScrollIndex, Math.round(ratio * maxScrollIndex))));
  };

  const handleThumbMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const track = trackRef.current;
    if (!track) return;
    const trackWidth = track.getBoundingClientRect().width;
    const startX = event.clientX;
    const startIndex = scrollIndex;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dRatio = dx / trackWidth;
      const dIndex = Math.round(dRatio * totalCount);
      onChange(Math.max(0, Math.min(maxScrollIndex, startIndex + dIndex)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="arena-seat__hand-scrollbar"
      ref={trackRef}
      onClick={handleTrackClick}
    >
      <div
        className="arena-seat__hand-scrollbar-thumb"
        style={{
          left: `${thumbLeft}%`,
          width: `${thumbRatio * 100}%`,
        }}
        onMouseDown={handleThumbMouseDown}
      />
    </div>
  );
}

const HandRailInner: React.FC<HandRailProps> = ({
  playerId,
  playerName,
  handHidden,
  command,
  hand,
  exile,
  graveyard,
  legalActions,
  previewCardId,
  previewMode,
  draggingCardId,
  onAction,
  onPreview,
  onPreviewClear,
  onDragStart,
  onDragEnd,
  registerCardElement,
  registerZoneAnchor,
}) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const [scrollIndex, setScrollIndex] = useState(0);

  const railItems = useMemo(
    () =>
      buildHandRailItems(
        playerId,
        handHidden,
        command,
        hand,
        exile,
        graveyard,
        legalActions,
      ),
    [playerId, handHidden, command, hand, exile, graveyard, legalActions],
  );

  const totalCards = railItems.length;
  const needsScroll = totalCards > MAX_VISIBLE;
  const maxScrollIndex = Math.max(0, totalCards - MAX_VISIBLE);
  const visibleCount = Math.min(totalCards, MAX_VISIBLE);

  // Clamp scroll index when card count changes
  const clampedScrollIndex = Math.max(0, Math.min(scrollIndex, maxScrollIndex));
  if (clampedScrollIndex !== scrollIndex) {
    setScrollIndex(clampedScrollIndex);
  }

  // Wheel scroll handler (needs passive: false for preventDefault)
  useEffect(() => {
    const el = areaRef.current;
    if (!el || !needsScroll) return;

    const handler = (event: WheelEvent) => {
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
      if (delta === 0) return;
      event.preventDefault();
      setScrollIndex((prev) =>
        Math.max(0, Math.min(maxScrollIndex, prev + Math.sign(delta))),
      );
    };

    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [needsScroll, maxScrollIndex]);

  const anchorCardIds = useMemo(() => {
    const next = new Map<RailAnchorZone, string>();

    for (const item of railItems) {
      if (
        item.kind === 'card' &&
        isRailAnchorZone(item.card.zone) &&
        !next.has(item.card.zone)
      ) {
        next.set(item.card.zone, item.card.objectId);
      }
    }

    return next;
  }, [railItems]);

  const containerWidthCalc =
    visibleCount <= 0
      ? '0px'
      : visibleCount === 1
        ? 'var(--hand-card-width, 72px)'
        : `calc(${visibleCount - 1} * var(--hand-card-step) + var(--hand-card-width, 72px))`;

  const renderRailItem = (item: HandRailItem) => {
    const { placement, visibleIndex, pileDistance } = getCardPlacement(
      item.railIndex,
      clampedScrollIndex,
      totalCards,
      needsScroll,
    );

    const positionStyle = getCardPositionStyle(
      placement,
      visibleIndex,
      pileDistance,
      visibleCount,
    );

    const railCardStyle: React.CSSProperties = {
      ...positionStyle,
    };
    const isPileTop = placement === 'pile-right' && item.railIndex === totalCards - 1;

    if (item.kind === 'hidden-hand') {
      return (
        <div
          key={item.key}
          className="arena-seat__hand-card"
          data-hidden-placeholder="true"
          data-placement={placement}
          data-pile-top={isPileTop || undefined}
          style={railCardStyle}
        >
          <div
            className="arena-card"
            data-variant="hand"
    
            data-hidden-placeholder="true"
            aria-hidden="true"
          />
        </div>
      );
    }

    const anchorZone =
      isRailAnchorZone(item.card.zone) && anchorCardIds.get(item.card.zone) === item.card.objectId
        ? item.card.zone
        : null;

    return (
      <div
        key={item.card.objectId}
        className="arena-seat__hand-card"
        data-placement={placement}
        data-pile-top={isPileTop || undefined}
        ref={
          anchorZone ? (node) => registerZoneAnchor(`${playerId}:${anchorZone}`, node) : undefined
        }
        style={railCardStyle}
      >
        <HandRailCard
          card={item.card}
          legalActions={legalActions}
          onAction={onAction}
          onPreview={onPreview}
          onPreviewClear={onPreviewClear}
          isPreviewed={previewCardId === item.card.objectId}
          previewMode={previewMode}
          draggingCardId={draggingCardId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          sourceZone={item.card.zone}
          mountRef={(node) => registerCardElement(item.card.objectId, node)}
        />
      </div>
    );
  };

  return (
    <div
      className="arena-seat__hand-area"
      ref={(node) => {
        (areaRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        registerZoneAnchor(`${playerId}:HAND`, node);
      }}
      data-hidden={handHidden}
      data-has-scroll={needsScroll}
      title={handHidden ? `${hand.length} cards in hand` : undefined}
      aria-label={handHidden ? `${playerName} has ${hand.length} cards in hand` : undefined}
      style={
        !needsScroll && totalCards > 1
          ? ({
              ['--hand-card-overlap' as string]: `${Math.round(-30 * (totalCards / MAX_VISIBLE))}px`,
            } as React.CSSProperties)
          : undefined
      }
    >
      {railItems.length > 0 ? (
        <>
          {needsScroll && (
            <HandScrollbar
              scrollIndex={clampedScrollIndex}
              maxScrollIndex={maxScrollIndex}
              visibleCount={visibleCount}
              totalCount={totalCards}
              onChange={setScrollIndex}
            />
          )}
          <div
            className="arena-seat__hand-cards"
            style={{
              width: containerWidthCalc,
              height: 'var(--hand-card-height, 96px)',
            }}
          >
            {railItems.map((item) => renderRailItem(item))}
          </div>
        </>
      ) : (
        <div className="arena-seat__rail-empty">No cards ready</div>
      )}
    </div>
  );
};

export const HandRail = React.memo(HandRailInner, handRailPropsEqual);
