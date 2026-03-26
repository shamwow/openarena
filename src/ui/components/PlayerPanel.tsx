import React, { useState } from 'react';
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
  previewCardId: string | null;
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

type OpenZoneDialog = Zone.GRAVEYARD | Zone.EXILE | null;

type RailAnchorZone = Zone.COMMAND | Zone.EXILE | Zone.GRAVEYARD;

interface HandRailCard {
  card: CardInstance;
  railIndex: number;
}

interface HandRailBackTile {
  kind: 'back';
  railIndex: number;
}

interface HandRailCardItem {
  kind: 'card';
  card: CardInstance;
  railIndex: number;
}

type HandRailItem = HandRailBackTile | HandRailCardItem;

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
  previewCardId,
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
  previewCardId: string | null;
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
            isPreviewed={previewCardId === card.objectId}
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
  zone: Zone.LIBRARY | Zone.GRAVEYARD | Zone.EXILE;
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

function buildHandRailCards(
  command: CardInstance[],
  hand: CardInstance[],
  exile: CardInstance[],
  graveyard: CardInstance[],
  legalActions: PlayerAction[],
): CardInstance[] {
  const playableCardIds = collectPlayableCardIds(legalActions);
  return [
    ...command,
    ...hand,
    ...exile.filter((card) => playableCardIds.has(card.objectId)),
    ...graveyard.filter((card) => playableCardIds.has(card.objectId)),
  ];
}

function buildHiddenHandRailItems(
  orderedRailCards: CardInstance[],
  hiddenHandCount: number,
): HandRailItem[] {
  const commandCards = orderedRailCards.filter((card) => card.zone === Zone.COMMAND);
  const trailingCards = orderedRailCards.filter((card) => card.zone !== Zone.COMMAND);

  return [
    ...commandCards.map<HandRailCardItem>((card, railIndex) => ({
      kind: 'card',
      card,
      railIndex,
    })),
    ...Array.from({ length: hiddenHandCount }, (_, index) => ({
      kind: 'back' as const,
      railIndex: commandCards.length + index,
    })),
    ...trailingCards.map<HandRailCardItem>((card, railIndex) => ({
      kind: 'card',
      card,
      railIndex: commandCards.length + hiddenHandCount + railIndex,
    })),
  ];
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  seat,
  player,
  zones,
  isActivePlayer,
  hasPriority,
  legalActions,
  onAction,
  onPreview,
  onPreviewClear,
  previewCardId,
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
  const [hoveredHandIndex, setHoveredHandIndex] = useState<number | null>(null);
  const [openZoneDialog, setOpenZoneDialog] = useState<OpenZoneDialog>(null);

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
  const orderedRailCards = buildHandRailCards(command, hand, exile, graveyard, legalActions);
  const railItems: HandRailItem[] = seat.handHidden
    ? buildHiddenHandRailItems(
        orderedRailCards.filter((card) => card.zone !== Zone.HAND),
        hand.length,
      )
    : orderedRailCards.map<HandRailCardItem>((card, railIndex) => ({
        kind: 'card',
        card,
        railIndex,
      }));
  const hasRailContent = railItems.length > 0;

  const anchorCardIds = new Map<RailAnchorZone, string>();
  for (const item of railItems) {
    if (item.kind !== 'card') {
      continue;
    }
    const { card } = item;
    if (isRailAnchorZone(card.zone) && !anchorCardIds.has(card.zone)) {
      anchorCardIds.set(card.zone, card.objectId);
    }
  }

  const getHandPresentation = (index: number): { scale: number; lift: number } => {
    if (touchFriendly || hoveredHandIndex == null) {
      return { scale: 1, lift: 0 };
    }

    const distance = Math.abs(hoveredHandIndex - index);
    if (distance === 0) {
      return { scale: 1.24, lift: 24 };
    }
    if (distance === 1) {
      return { scale: 1.12, lift: 14 };
    }
    if (distance === 2) {
      return { scale: 1.05, lift: 6 };
    }
    return { scale: 1, lift: 0 };
  };

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

  const renderRailCard = ({ card, railIndex }: HandRailCard, wrapperClassName?: string) => {
    const presentation = getHandPresentation(railIndex);
    const anchorZone =
      isRailAnchorZone(card.zone) && anchorCardIds.get(card.zone) === card.objectId
        ? card.zone
        : null;
    const baseZIndex = seat.handHidden
      ? card.zone === Zone.COMMAND
        ? 1000 + railIndex
        : 500 + railIndex
      : Math.max(1, railIndex + 1);

    return (
      <div
        key={card.objectId}
        className={wrapperClassName ? `arena-seat__hand-card ${wrapperClassName}` : 'arena-seat__hand-card'}
        ref={anchorZone ? (node) => registerZoneAnchor(`${player.id}:${anchorZone}`, node) : undefined}
        onMouseEnter={() => setHoveredHandIndex(railIndex)}
        style={{
          zIndex: hoveredHandIndex === railIndex ? 30 : baseZIndex,
        }}
      >
        <CardView
          card={card}
          variant="hand"
          legalActions={legalActions}
          onAction={onAction}
          onPreview={onPreview}
          onPreviewClear={onPreviewClear}
          isPreviewed={previewCardId === card.objectId}
          previewMode={touchFriendly ? 'tap' : 'hover'}
          scale={presentation.scale}
          lift={presentation.lift}
          draggableAction={getPrimaryCardAction(card, legalActions)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          isDragging={draggingCardId === card.objectId}
          sourceZone={card.zone}
          mountRef={(node) => registerCardElement(card.objectId, node)}
        />
      </div>
    );
  };

  const renderBackTile = (railIndex: number) => (
    <div
      key={`hidden-hand-back-${railIndex}`}
      className="arena-seat__hand-card"
      aria-hidden="true"
      style={{
        pointerEvents: 'none',
        zIndex: 100 + railIndex,
      }}
    >
      <div className="arena-card arena-card-back" data-variant="hand" />
    </div>
  );

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
          previewCardId={previewCardId}
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
          previewCardId={previewCardId}
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
          previewCardId={previewCardId}
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
          onMouseLeave={() => setHoveredHandIndex(null)}
        >
          {hasRailContent ? (
            <div className="arena-seat__hand-scroll">
              <div
                className="arena-seat__hand-rail"
                aria-label={seat.handHidden ? `${hand.length} hidden cards in hand` : undefined}
                title={seat.handHidden ? `${hand.length} hidden cards in hand` : undefined}
              >
                <div className="arena-seat__hand-cards">
                  {railItems.map((railItem) =>
                    railItem.kind === 'back'
                      ? renderBackTile(railItem.railIndex)
                      : renderRailCard(railItem),
                  )}
                </div>
              </div>
            </div>
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
          previewCardId={previewCardId}
          touchFriendly={touchFriendly}
          onPreview={onPreview}
          onPreviewClear={onPreviewClear}
          onClose={() => setOpenZoneDialog(null)}
        />
      )}
    </section>
  );
};
