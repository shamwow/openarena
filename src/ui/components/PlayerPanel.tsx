import React, { useState, useRef, useLayoutEffect, useMemo, useEffect, useCallback } from 'react';
import type {
  CardInstance,
  ManaPool,
  PlayerAction,
  PlayerId,
  PlayerState,
} from '../../engine/types';
import { ActionType, CardType, Zone } from '../../engine/types';
import type { DragCardPayload, SeatMeta } from '../types';
import { getPrimaryCardAction } from '../utils/gameView';
import { CardView } from './CardView';
import { ZoneDialog } from './ZoneDialog';

interface PlayerPanelProps {
  seat: SeatMeta;
  player: PlayerState;
  zones: Record<Zone, CardInstance[]>;
  isActivePlayer: boolean;
  hasPriority: boolean;
  legalActions: PlayerAction[];
  onAction: (action: PlayerAction) => void;
  onPreview: (card: CardInstance) => void;
  onPreviewClear: (cardId?: string) => void;
  touchFriendly: boolean;
  onDragStart: (payload: DragCardPayload) => void;
  onDragEnd: () => void;
  draggingCardId: string | null;
  isDropActive: boolean;
  onBattlefieldDragOver: (playerId: PlayerId) => void;
  onBattlefieldDragLeave: () => void;
  onBattlefieldDrop: (playerId: PlayerId) => void;
  registerCardElement: (cardId: string, node: HTMLDivElement | null) => void;
  registerZoneAnchor: (key: string, node: HTMLElement | null) => void;
}

type OpenZoneDialog = typeof Zone.GRAVEYARD | typeof Zone.EXILE | null;

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

const MANA_COLORS: Record<keyof ManaPool, string> = {
  W: '#f9f5e3',
  U: '#0e68ab',
  B: '#45373a',
  R: '#d3202a',
  G: '#00733e',
  C: '#beb9b2',
};

function ManaPoolDisplay({ pool }: { pool: ManaPool }) {
  const entries = (Object.keys(pool) as (keyof ManaPool)[]).filter((color) => pool[color] > 0);

  if (entries.length === 0) {
    return <div className="arena-pill">Mana pool empty</div>;
  }

  return (
    <div className="arena-seat__mana">
      {entries.map((color) => (
        <span key={color} className="arena-mana-pill">
          <span
            className="arena-mana-pill__dot"
            style={{ backgroundColor: MANA_COLORS[color] }}
          />
          <strong>{pool[color]}</strong>
        </span>
      ))}
    </div>
  );
}

function getLifeDanger(player: PlayerState): { danger: boolean; critical: boolean } {
  return {
    danger: player.life <= 20,
    critical: player.life <= 10,
  };
}

function BattlefieldGroup({
  title,
  cards,
  legalActions,
  touchFriendly,
  draggingCardId,
  onAction,
  onPreview,
  onPreviewClear,
  onDragStart,
  onDragEnd,
  registerCardElement,
}: {
  title: string;
  cards: CardInstance[];
  legalActions: PlayerAction[];
  touchFriendly: boolean;
  draggingCardId: string | null;
  onAction: (action: PlayerAction) => void;
  onPreview: (card: CardInstance) => void;
  onPreviewClear: (cardId?: string) => void;
  onDragStart: (payload: DragCardPayload) => void;
  onDragEnd: () => void;
  registerCardElement: (cardId: string, node: HTMLDivElement | null) => void;
}) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="arena-seat__battlefield-group">
      <div className="arena-seat__group-label">
        <span>{title}</span>
        <span>{cards.length}</span>
      </div>
      <div className="arena-seat__card-row">
        {cards.map((card) => (
          <CardView
            key={card.objectId}
            card={card}
            legalActions={legalActions}
            onAction={onAction}
            onPreview={onPreview}
            onPreviewClear={onPreviewClear}
            previewMode={touchFriendly ? 'tap' : 'hover'}
            draggableAction={null}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            isDragging={draggingCardId === card.objectId}
            mountRef={(node) => registerCardElement(card.objectId, node)}
          />
        ))}
      </div>
    </div>
  );
}

function ZonePile({
  zone,
  count,
  side,
  onClick,
  registerZoneAnchor,
}: {
  zone: typeof Zone.LIBRARY | typeof Zone.GRAVEYARD | typeof Zone.EXILE;
  count: number;
  side: 'left' | 'right';
  onClick?: () => void;
  registerZoneAnchor: (node: HTMLElement | null) => void;
}) {
  const zoneLabel =
    zone === Zone.LIBRARY ? 'Library' : zone === Zone.GRAVEYARD ? 'Graveyard' : 'Exile';
  const shortLabel =
    zone === Zone.LIBRARY ? 'LIB' : zone === Zone.GRAVEYARD ? 'GY' : 'EX';
  const pileCount = Math.max(1, Math.min(4, count));
  const pile = (
    <>
      <div className="arena-zone-pile__stack" aria-hidden="true">
        {Array.from({ length: pileCount }).map((_, index) => (
          <span
            key={`${zone}-${index}`}
            className="arena-zone-pile__card"
            style={{ ['--pile-index' as string]: `${index}` } as React.CSSProperties}
          />
        ))}
      </div>
      <span className="arena-zone-pile__tag">{shortLabel}</span>
      <span className="arena-zone-pile__label">
        {zoneLabel} {count}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="arena-zone-pile"
        data-zone={zone}
        data-side={side}
        disabled={count === 0}
        onClick={onClick}
        ref={registerZoneAnchor}
      >
        {pile}
      </button>
    );
  }

  return (
    <div
      className="arena-zone-pile"
      data-zone={zone}
      data-side={side}
      data-static="true"
      ref={registerZoneAnchor}
    >
      {pile}
    </div>
  );
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

interface HandRailProps {
  railItems: HandRailItem[];
  legalActions: PlayerAction[];
  touchFriendly: boolean;
  onAction: (action: PlayerAction) => void;
  onDragStart: (payload: DragCardPayload) => void;
  onDragEnd: () => void;
  draggingCardId: string | null;
  registerCardElement: (cardId: string, node: HTMLDivElement | null) => void;
  registerZoneAnchor: (key: string, node: HTMLElement | null) => void;
  playerId: PlayerId;
  handCardsRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const HandRail = React.memo(function HandRail({
  railItems,
  legalActions,
  touchFriendly,
  onAction,
  onDragStart,
  onDragEnd,
  draggingCardId,
  registerCardElement,
  registerZoneAnchor,
  playerId,
  handCardsRef,
  scrollRef,
}: HandRailProps) {
  const hoveredHandIndexRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    const handCardsEl = handCardsRef.current;
    if (!scrollEl || !handCardsEl) return;

    const update = () => {
      const count = handCardsEl.children.length;
      if (count <= 1) {
        handCardsEl.style.removeProperty('--hand-card-overlap');
        return;
      }

      handCardsEl.style.removeProperty('--hand-card-overlap');

      const available = scrollEl.clientWidth;
      const naturalWidth = handCardsEl.scrollWidth;
      if (naturalWidth <= available) return;

      const firstCardEl = handCardsEl.querySelector('[data-variant="hand"]') as HTMLElement | null;
      if (!firstCardEl) return;
      const cardWidth = firstCardEl.offsetWidth;

      const neededOverlap = (cardWidth * count - available) / (count - 1);
      const maxOverlap = cardWidth - 5;
      const overlap = Math.min(Math.max(0, neededOverlap), maxOverlap);
      handCardsEl.style.setProperty('--hand-card-overlap', `-${overlap}px`);
    };

    const observer = new ResizeObserver(update);
    observer.observe(scrollEl);
    update();

    return () => observer.disconnect();
  }, [railItems.length, scrollRef, handCardsRef]);

  const anchorCardIds = new Map<RailAnchorZone, string>();
  const primaryActions = new Map<string, PlayerAction | null>();
  for (const item of railItems) {
    if (item.kind === 'card') {
      if (isRailAnchorZone(item.card.zone) && !anchorCardIds.has(item.card.zone)) {
        anchorCardIds.set(item.card.zone, item.card.objectId);
      }
      primaryActions.set(item.card.objectId, getPrimaryCardAction(item.card, legalActions));
    }
  }

  const handleMouseLeave = useCallback(() => {
    hoveredHandIndexRef.current = null;
    const el = handCardsRef.current;
    if (el) {
      el.removeAttribute('data-hovered-index');
      el.style.removeProperty('--hand-hovered-index');
    }
  }, [handCardsRef]);

  const setHoveredIndex = (index: number | null) => {
    hoveredHandIndexRef.current = index;
    const el = handCardsRef.current;
    if (!el) return;
    if (touchFriendly || index == null) {
      el.removeAttribute('data-hovered-index');
      el.style.removeProperty('--hand-hovered-index');
    } else {
      el.setAttribute('data-hovered-index', `${index}`);
      el.style.setProperty('--hand-hovered-index', `${index}`);
    }
  };

  // Re-sync after React re-renders
  useLayoutEffect(() => {
    const el = handCardsRef.current;
    if (!el) return;
    const idx = hoveredHandIndexRef.current;
    if (touchFriendly || idx == null) {
      el.removeAttribute('data-hovered-index');
      el.style.removeProperty('--hand-hovered-index');
    } else {
      el.setAttribute('data-hovered-index', `${idx}`);
      el.style.setProperty('--hand-hovered-index', `${idx}`);
    }
  });

  const renderRailItem = (item: HandRailItem) => {
    const wrapperStyle = {
      '--card-index': item.railIndex,
      '--card-count': railItems.length,
    } as React.CSSProperties;

    if (item.kind === 'hidden-hand') {
      return (
        <div
          key={item.key}
          className="arena-seat__hand-card"
          data-hidden-placeholder="true"
          onMouseEnter={() => setHoveredIndex(item.railIndex)}
          style={wrapperStyle}
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
        data-object-id={item.card.objectId}
        ref={anchorZone ? (node) => registerZoneAnchor(`${playerId}:${anchorZone}`, node) : undefined}
        onMouseEnter={() => setHoveredIndex(item.railIndex)}
        style={wrapperStyle}
      >
        <CardView
          card={item.card}
          variant="hand"
          legalActions={legalActions}
          onAction={onAction}
          previewMode={touchFriendly ? 'tap' : 'hover'}
          draggableAction={primaryActions.get(item.card.objectId) ?? null}
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
    <div className="arena-seat__hand-scroll" ref={scrollRef} onMouseLeave={handleMouseLeave}>
      <div className="arena-seat__hand-rail">
        <div className="arena-seat__hand-cards" ref={handCardsRef}>
          {railItems.map((item) => renderRailItem(item))}
        </div>
      </div>
    </div>
  );
});

export const PlayerPanel: React.FC<PlayerPanelProps> = React.memo(({
  seat,
  player,
  zones,
  isActivePlayer,
  hasPriority,
  legalActions,
  onAction,
  onPreview,
  onPreviewClear,
  touchFriendly,
  onDragStart,
  onDragEnd,
  draggingCardId,
  isDropActive,
  onBattlefieldDragOver,
  onBattlefieldDragLeave,
  onBattlefieldDrop,
  registerCardElement,
  registerZoneAnchor,
}) => {
  const [openZoneDialog, setOpenZoneDialog] = useState<OpenZoneDialog>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handCardsRef = useRef<HTMLDivElement>(null);

  const hand = zones.HAND ?? [];
  const battlefield = zones.BATTLEFIELD ?? [];
  const graveyard = zones.GRAVEYARD ?? [];
  const exile = zones.EXILE ?? [];
  const library = zones.LIBRARY ?? [];
  const command = zones.COMMAND ?? [];

  const lands = battlefield.filter((card) => card.definition.types.includes(CardType.LAND));
  const creatures = battlefield.filter((card) => card.definition.types.includes(CardType.CREATURE));
  const support = battlefield.filter(
    (card) =>
      !card.definition.types.includes(CardType.LAND) &&
      !card.definition.types.includes(CardType.CREATURE),
  );

  const lifeState = getLifeDanger(player);
  const infoSide = seat.position.endsWith('right') ? 'left' : 'right';
  const railItems = useMemo(
    () => buildHandRailItems(player.id, seat.handHidden, command, hand, exile, graveyard, legalActions),
    [player.id, seat.handHidden, command, hand, exile, graveyard, legalActions],
  );

  // Card lookup map for native DOM preview handlers
  const cardMapRef = useRef(new Map<string, CardInstance>());
  cardMapRef.current.clear();
  for (const item of railItems) {
    if (item.kind === 'card') {
      cardMapRef.current.set(item.card.objectId, item.card);
    }
  }

  // Stable refs for callbacks so native handlers always call the latest version
  const onPreviewRef = useRef(onPreview);
  const onPreviewClearRef = useRef(onPreviewClear);
  onPreviewRef.current = onPreview;
  onPreviewClearRef.current = onPreviewClear;

  // Native DOM event handlers for card preview — completely outside React
  useEffect(() => {
    const container = handCardsRef.current;
    if (!container) return;

    let currentPreviewId: string | null = null;

    const handleOver = (e: Event) => {
      const wrapper = (e.target as HTMLElement).closest('.arena-seat__hand-card[data-object-id]');
      if (!wrapper) return;
      const objectId = wrapper.getAttribute('data-object-id')!;
      if (objectId === currentPreviewId) return;

      // Clear any previously previewed card (hand rail or battlefield)
      document.querySelector('[data-previewed="true"]')?.setAttribute('data-previewed', 'false');
      document.querySelector('[data-selected="true"]')?.removeAttribute('data-selected');

      currentPreviewId = objectId;
      wrapper.querySelector('.arena-card')?.setAttribute('data-previewed', 'true');

      const card = cardMapRef.current.get(objectId);
      if (card) onPreviewRef.current(card);
    };

    const handleOut = (e: Event) => {
      const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
      if (related && container.contains(related)) return;

      if (currentPreviewId) {
        container.querySelector(`[data-object-id="${currentPreviewId}"] .arena-card`)
          ?.setAttribute('data-previewed', 'false');
        onPreviewClearRef.current(currentPreviewId);
        currentPreviewId = null;
      }
    };

    container.addEventListener('mouseover', handleOver);
    container.addEventListener('mouseout', handleOut);

    return () => {
      container.removeEventListener('mouseover', handleOver);
      container.removeEventListener('mouseout', handleOut);
    };
  }, []);

  const handleBattlefieldDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onBattlefieldDrop(player.id);
  };

  const handleBattlefieldDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onBattlefieldDragOver(player.id);
  };

  const dialogCards =
    openZoneDialog === Zone.GRAVEYARD ? graveyard : openZoneDialog === Zone.EXILE ? exile : [];

  return (
    <section
      className="arena-seat"
      data-active={isActivePlayer}
      data-priority={hasPriority}
      data-drop-active={isDropActive}
      data-position={seat.position}
      data-info-side={infoSide}
    >
      <div className="arena-seat__overlay" data-side={infoSide}>
        <div className="arena-seat__crest">
          <h2
            className="arena-seat__name"
            style={{
              color: player.hasLost ? 'rgba(143, 132, 111, 0.9)' : undefined,
              textDecoration: player.hasLost ? 'line-through' : undefined,
            }}
          >
            {player.name}
          </h2>
          <div
            className="arena-seat__life"
            data-danger={lifeState.danger}
            data-critical={lifeState.critical}
          >
            {player.life}
          </div>
          <div className="arena-preview__meta">life total</div>
        </div>

        <ManaPoolDisplay pool={player.manaPool} />

        {player.poisonCounters > 0 ||
        Object.values(player.commanderDamageReceived).some((damage) => damage > 0) ? (
          <div className="arena-seat__markers">
            {player.poisonCounters > 0 && (
              <span className="arena-pill">
                Poison <strong>{player.poisonCounters}/10</strong>
              </span>
            )}
            {Object.entries(player.commanderDamageReceived)
              .filter(([, damage]) => damage > 0)
              .map(([commanderId, damage]) => (
                <span key={commanderId} className="arena-pill">
                  Cmdr <strong>{damage}/21</strong>
                </span>
              ))}
          </div>
        ) : null}
      </div>

      <div
        className="arena-seat__battlefield"
        ref={(node) => registerZoneAnchor(`${player.id}:BATTLEFIELD`, node)}
        onDrop={handleBattlefieldDrop}
        onDragOver={handleBattlefieldDragOver}
        onDragLeave={onBattlefieldDragLeave}
      >
        <BattlefieldGroup
          title="Creatures"
          cards={creatures}
          legalActions={legalActions}
          touchFriendly={touchFriendly}
          draggingCardId={draggingCardId}
          onAction={onAction}
          onPreview={onPreview}
          onPreviewClear={onPreviewClear}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          registerCardElement={registerCardElement}
        />
        <BattlefieldGroup
          title="Support"
          cards={support}
          legalActions={legalActions}
          touchFriendly={touchFriendly}
          draggingCardId={draggingCardId}
          onAction={onAction}
          onPreview={onPreview}
          onPreviewClear={onPreviewClear}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          registerCardElement={registerCardElement}
        />
        <BattlefieldGroup
          title="Lands"
          cards={lands}
          legalActions={legalActions}
          touchFriendly={touchFriendly}
          draggingCardId={draggingCardId}
          onAction={onAction}
          onPreview={onPreview}
          onPreviewClear={onPreviewClear}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          registerCardElement={registerCardElement}
        />
      </div>

      <div className="arena-seat__zone-rail">
        <div className="arena-seat__zone-piles" data-side="left">
          <ZonePile
            zone={Zone.EXILE}
            count={exile.length}
            side="left"
            onClick={() => setOpenZoneDialog(Zone.EXILE)}
            registerZoneAnchor={(node) => registerZoneAnchor(`${player.id}:EXILE`, node)}
          />
          <ZonePile
            zone={Zone.GRAVEYARD}
            count={graveyard.length}
            side="left"
            onClick={() => setOpenZoneDialog(Zone.GRAVEYARD)}
            registerZoneAnchor={(node) => registerZoneAnchor(`${player.id}:GRAVEYARD`, node)}
          />
        </div>

        <div
          className="arena-seat__hand-area"
          ref={(node) => registerZoneAnchor(`${player.id}:HAND`, node)}
          data-hidden={seat.handHidden}
          title={seat.handHidden ? `${hand.length} cards in hand` : undefined}
          aria-label={seat.handHidden ? `${player.name} has ${hand.length} cards in hand` : undefined}
        >
          {railItems.length > 0 ? (
            <HandRail
              railItems={railItems}
              legalActions={legalActions}
              touchFriendly={touchFriendly}
              onAction={onAction}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              draggingCardId={draggingCardId}
              registerCardElement={registerCardElement}
              registerZoneAnchor={registerZoneAnchor}
              playerId={player.id}
              handCardsRef={handCardsRef}
              scrollRef={scrollRef}
            />
          ) : (
            <div className="arena-seat__rail-empty">No cards ready</div>
          )}
        </div>

        <div className="arena-seat__zone-piles" data-side="right">
          <ZonePile
            zone={Zone.LIBRARY}
            count={library.length}
            side="right"
            registerZoneAnchor={(node) => registerZoneAnchor(`${player.id}:LIBRARY`, node)}
          />
        </div>
      </div>

      {openZoneDialog && (
        <ZoneDialog
          playerName={player.name}
          zone={openZoneDialog}
          cards={dialogCards}
          touchFriendly={touchFriendly}
          onPreview={onPreview}
          onPreviewClear={onPreviewClear}
          onClose={() => setOpenZoneDialog(null)}
        />
      )}
    </section>
  );
});
