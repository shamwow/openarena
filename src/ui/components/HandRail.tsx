import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import type { CardInstance, PlayerAction, PlayerId } from '../../engine/types';
import { ActionType, Zone } from '../../engine/types';
import type { DragCardPayload } from '../types';
import { getPrimaryCardAction } from '../utils/gameView';
import { CardView } from './CardView';

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

function distributeWeightedAmount(
  weights: number[],
  total: number,
  capacities?: number[],
): number[] {
  const result = Array.from({ length: weights.length }, () => 0);
  if (total <= 0 || weights.length === 0) {
    return result;
  }

  let remaining = total;
  let activeIndexes = weights
    .map((weight, index) => ({ weight, index }))
    .filter(
      ({ weight, index }) =>
        weight > 0 && (capacities == null || (capacities[index] ?? 0) > 0),
    )
    .map(({ index }) => index);

  while (remaining > 0.001 && activeIndexes.length > 0) {
    const activeWeightSum = activeIndexes.reduce((sum, index) => sum + weights[index], 0);
    if (activeWeightSum <= 0) {
      break;
    }

    let distributed = 0;
    const nextActiveIndexes: number[] = [];

    for (const index of activeIndexes) {
      const share = remaining * (weights[index] / activeWeightSum);
      const capacity = capacities?.[index] ?? Number.POSITIVE_INFINITY;
      const available = capacity - result[index];
      const nextAmount = Math.max(0, Math.min(share, available));
      result[index] += nextAmount;
      distributed += nextAmount;

      if (result[index] + 0.001 < capacity) {
        nextActiveIndexes.push(index);
      }
    }

    if (distributed <= 0.001) {
      break;
    }

    remaining -= distributed;
    activeIndexes = nextActiveIndexes;
  }

  return result;
}

function buildSideOverlapDeltas(
  gapCount: number,
  baseOverlap: number,
  cardWidth: number,
): number[] {
  if (gapCount <= 1) {
    return Array.from({ length: gapCount }, () => 0);
  }

  const overlapMagnitude = Math.abs(baseOverlap);
  const baseContribution = Math.max(1, cardWidth + baseOverlap);
  const compressionCapacity = Math.max(0, baseContribution - 1);
  const requestedNearExpansion = Math.min(
    Math.max(4, overlapMagnitude * 0.24),
    18,
    Math.max(0, overlapMagnitude - 2),
  );

  if (compressionCapacity <= 0.001 || requestedNearExpansion <= 0.001) {
    return Array.from({ length: gapCount }, () => 0);
  }

  const expandWeights = Array.from({ length: gapCount }, (_, index) => Math.pow(0.58, index));
  const compressWeights = Array.from({ length: gapCount }, (_, index) =>
    Math.pow(index / (gapCount - 1), 1.35),
  );
  const compressCapacities = compressWeights.map((weight) =>
    weight > 0 ? compressionCapacity : 0,
  );
  const expandWeightSum = expandWeights.reduce((sum, weight) => sum + weight, 0);
  const totalCompressionCapacity = compressCapacities.reduce((sum, value) => sum + value, 0);
  const requestedTotalExpansion = requestedNearExpansion * expandWeightSum;
  const totalExpansion = Math.min(requestedTotalExpansion, totalCompressionCapacity);

  if (totalExpansion <= 0.001) {
    return Array.from({ length: gapCount }, () => 0);
  }

  const expandDeltas = distributeWeightedAmount(expandWeights, totalExpansion);
  const compressDeltas = distributeWeightedAmount(
    compressWeights,
    totalExpansion,
    compressCapacities,
  );

  return expandDeltas.map((expandDelta, index) => expandDelta - compressDeltas[index]);
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const handCardsRef = useRef<HTMLDivElement>(null);
  const baseOverlapRef = useRef<number>(-43);

  const clearHoverSpacing = useCallback(() => {
    const handCardsEl = handCardsRef.current;
    if (!handCardsEl) {
      return;
    }

    for (const child of handCardsEl.children) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }

      child.style.removeProperty('--hand-card-local-overlap');
      child.style.removeProperty('--hand-z-hover-order');
    }
  }, []);

  const applyHoverSpacing = useCallback((hoveredIndex: number) => {
    const handCardsEl = handCardsRef.current;
    if (!handCardsEl) {
      return;
    }

    const children = Array.from(handCardsEl.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );
    if (children.length <= 1) {
      return;
    }

    const baseOverlap = baseOverlapRef.current;
    const firstCardEl = handCardsEl.querySelector('[data-variant="hand"]') as HTMLElement | null;
    if (!firstCardEl) {
      return;
    }

    const cardWidth = firstCardEl.offsetWidth;

    const leftGapCount = hoveredIndex;
    const rightGapCount = children.length - hoveredIndex - 1;
    const leftDeltas = buildSideOverlapDeltas(leftGapCount, baseOverlap, cardWidth);
    const rightDeltas = buildSideOverlapDeltas(rightGapCount, baseOverlap, cardWidth);

    for (const [index, child] of children.entries()) {
      if (index === hoveredIndex) {
        child.style.setProperty('--hand-z-hover-order', `${children.length * 3}`);
      } else if (index > hoveredIndex) {
        const rightDistance = index - hoveredIndex;
        const rightStackOrder = (children.length - rightDistance) * 2;
        child.style.setProperty('--hand-z-hover-order', `${rightStackOrder}`);
      } else {
        child.style.removeProperty('--hand-z-hover-order');
      }

      if (index === children.length - 1) {
        child.style.removeProperty('--hand-card-local-overlap');
        continue;
      }

      let delta = 0;
      if (index < hoveredIndex) {
        delta = leftDeltas[hoveredIndex - 1 - index] ?? 0;
      } else if (index >= hoveredIndex) {
        delta = rightDeltas[index - hoveredIndex] ?? 0;
      }

      child.style.setProperty('--hand-card-local-overlap', `${baseOverlap + delta}px`);
    }
  }, []);

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

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    const handCardsEl = handCardsRef.current;
    if (!scrollEl || !handCardsEl) {
      return;
    }

    const update = () => {
      clearHoverSpacing();

      const count = handCardsEl.children.length;
      if (count <= 1) {
        handCardsEl.style.removeProperty('--hand-card-overlap');
        baseOverlapRef.current = 0;
        return;
      }

      handCardsEl.style.removeProperty('--hand-card-overlap');

      const firstCardEl = handCardsEl.querySelector('[data-variant="hand"]') as HTMLElement | null;
      if (!firstCardEl) {
        return;
      }

      const available = scrollEl.clientWidth;
      const naturalWidth = handCardsEl.scrollWidth;
      if (naturalWidth <= available) {
        baseOverlapRef.current = Number.parseFloat(getComputedStyle(firstCardEl).marginRight);
        return;
      }

      const cardWidth = firstCardEl.offsetWidth;
      const neededOverlap = (cardWidth * count - available) / (count - 1);
      const maxOverlap = cardWidth - 5;
      const overlap = Math.min(Math.max(0, neededOverlap), maxOverlap);
      handCardsEl.style.setProperty('--hand-card-overlap', `-${overlap}px`);
      baseOverlapRef.current = -overlap;
    };

    const observer = new ResizeObserver(update);
    observer.observe(scrollEl);
    update();

    return () => observer.disconnect();
  }, [clearHoverSpacing, railItems.length]);

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

  const renderRailItem = (item: HandRailItem) => {
    const baseZIndex = Math.max(1, item.railIndex + 1);
    const railCardStyle = {
      ['--hand-z-base' as string]: `${baseZIndex}`,
    } as React.CSSProperties;

    if (item.kind === 'hidden-hand') {
      return (
        <div
          key={item.key}
          className="arena-seat__hand-card"
          data-hidden-placeholder="true"
          style={railCardStyle}
          onMouseEnter={previewMode === 'hover' ? () => applyHoverSpacing(item.railIndex) : undefined}
        >
          <div
            className="arena-card arena-card-back"
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
        ref={
          anchorZone ? (node) => registerZoneAnchor(`${playerId}:${anchorZone}`, node) : undefined
        }
        style={railCardStyle}
        onMouseEnter={previewMode === 'hover' ? () => applyHoverSpacing(item.railIndex) : undefined}
      >
        <CardView
          card={item.card}
          variant="hand"
          legalActions={legalActions}
          onAction={onAction}
          onPreview={onPreview}
          onPreviewClear={onPreviewClear}
          isPreviewed={previewCardId === item.card.objectId}
          previewMode={previewMode}
          draggableAction={getPrimaryCardAction(item.card, legalActions)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          isDragging={draggingCardId === item.card.objectId}
          sourceZone={item.card.zone}
          mountRef={(node) => registerCardElement(item.card.objectId, node)}
        />
      </div>
    );
  };

  return (
    <div
      className="arena-seat__hand-area"
      ref={(node) => registerZoneAnchor(`${playerId}:HAND`, node)}
      data-hidden={handHidden}
      title={handHidden ? `${hand.length} cards in hand` : undefined}
      aria-label={handHidden ? `${playerName} has ${hand.length} cards in hand` : undefined}
      onMouseLeave={previewMode === 'hover' ? clearHoverSpacing : undefined}
    >
      {railItems.length > 0 ? (
        <div className="arena-seat__hand-scroll" ref={scrollRef}>
          <div className="arena-seat__hand-rail">
            <div className="arena-seat__hand-cards" ref={handCardsRef}>
              {railItems.map((item) => renderRailItem(item))}
            </div>
          </div>
        </div>
      ) : (
        <div className="arena-seat__rail-empty">No cards ready</div>
      )}
    </div>
  );
};

export const HandRail = React.memo(HandRailInner, handRailPropsEqual);
