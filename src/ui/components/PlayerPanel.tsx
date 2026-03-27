import React, { useMemo, useState } from 'react';
import type {
  CardInstance,
  PlayerAction,
  PlayerId,
  PlayerState,
} from '../../engine/types';
import { CardType, Zone } from '../../engine/types';
import type { DragCardPayload, SeatMeta } from '../types';
import { CardExplorer } from './CardExplorer';
import { CardView } from './CardView';
import { HandRail } from './HandRail';
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

type OpenZoneDialog = 'GRAVEYARD_EXILE' | 'LIBRARY_EXPLORER' | null;

function getLifeDanger(player: PlayerState): { danger: boolean; critical: boolean } {
  return {
    danger: player.life <= 20,
    critical: player.life <= 10,
  };
}

function cardsContainCardId(cards: CardInstance[], cardId: string | null): boolean {
  return cardId != null && cards.some((card) => card.objectId === cardId);
}

function zonesContainCardId(
  zones: Record<Zone, CardInstance[]>,
  cardId: string | null,
): boolean {
  return cardId != null && Object.values(zones).some((cards) => cardsContainCardId(cards, cardId));
}

interface BattlefieldGroupProps {
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
}

function battlefieldGroupPropsEqual(
  prev: BattlefieldGroupProps,
  next: BattlefieldGroupProps,
): boolean {
  if (
    prev.title !== next.title ||
    prev.cards !== next.cards ||
    prev.legalActions !== next.legalActions ||
    prev.touchFriendly !== next.touchFriendly ||
    prev.onAction !== next.onAction ||
    prev.onPreview !== next.onPreview ||
    prev.onPreviewClear !== next.onPreviewClear ||
    prev.onDragStart !== next.onDragStart ||
    prev.onDragEnd !== next.onDragEnd ||
    prev.registerCardElement !== next.registerCardElement
  ) {
    return false;
  }

  const previewRelevant =
    cardsContainCardId(prev.cards, prev.previewCardId) ||
    cardsContainCardId(next.cards, next.previewCardId);
  if (previewRelevant && prev.previewCardId !== next.previewCardId) {
    return false;
  }

  const draggingRelevant =
    cardsContainCardId(prev.cards, prev.draggingCardId) ||
    cardsContainCardId(next.cards, next.draggingCardId);
  if (draggingRelevant && prev.draggingCardId !== next.draggingCardId) {
    return false;
  }

  return true;
}

const BattlefieldGroupInner: React.FC<BattlefieldGroupProps> = ({
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
}) => {
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
};

const BattlefieldGroup = React.memo(BattlefieldGroupInner, battlefieldGroupPropsEqual);

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

function CombinedZonePile({
  graveyardCount,
  exileCount,
  onClick,
  registerGraveyardAnchor,
  registerExileAnchor,
}: {
  graveyardCount: number;
  exileCount: number;
  onClick: () => void;
  registerGraveyardAnchor: (node: HTMLElement | null) => void;
  registerExileAnchor: (node: HTMLElement | null) => void;
}) {
  const totalCount = graveyardCount + exileCount;
  const pileCount = Math.max(1, Math.min(4, totalCount));

  return (
    <button
      type="button"
      className="arena-zone-pile"
      data-zone="GRAVEYARD_EXILE"
      data-side="left"
      disabled={totalCount === 0}
      onClick={onClick}
      ref={(node) => {
        registerGraveyardAnchor(node);
        registerExileAnchor(node);
      }}
    >
      <div className="arena-zone-pile__stack" aria-hidden="true">
        {Array.from({ length: pileCount }).map((_, index) => (
          <span
            key={`gy-ex-${index}`}
            className="arena-zone-pile__card"
            style={{ ['--pile-index' as string]: `${index}` } as React.CSSProperties}
          />
        ))}
      </div>
      <span className="arena-zone-pile__tag">GY/EX</span>
      <span className="arena-zone-pile__label">
        Graveyard {graveyardCount} / Exile {exileCount}
      </span>
    </button>
  );
}

function playerPanelPropsEqual(prev: PlayerPanelProps, next: PlayerPanelProps): boolean {
  if (
    prev.seat !== next.seat ||
    prev.player !== next.player ||
    prev.zones !== next.zones ||
    prev.isActivePlayer !== next.isActivePlayer ||
    prev.hasPriority !== next.hasPriority ||
    prev.legalActions !== next.legalActions ||
    prev.onAction !== next.onAction ||
    prev.onPreview !== next.onPreview ||
    prev.onPreviewClear !== next.onPreviewClear ||
    prev.touchFriendly !== next.touchFriendly ||
    prev.onDragStart !== next.onDragStart ||
    prev.onDragEnd !== next.onDragEnd ||
    prev.isDropActive !== next.isDropActive ||
    prev.onBattlefieldDragOver !== next.onBattlefieldDragOver ||
    prev.onBattlefieldDragLeave !== next.onBattlefieldDragLeave ||
    prev.onBattlefieldDrop !== next.onBattlefieldDrop ||
    prev.registerCardElement !== next.registerCardElement ||
    prev.registerZoneAnchor !== next.registerZoneAnchor
  ) {
    return false;
  }

  const previewRelevant =
    zonesContainCardId(prev.zones, prev.previewCardId) ||
    zonesContainCardId(next.zones, next.previewCardId);
  if (previewRelevant && prev.previewCardId !== next.previewCardId) {
    return false;
  }

  const draggingRelevant =
    zonesContainCardId(prev.zones, prev.draggingCardId) ||
    zonesContainCardId(next.zones, next.draggingCardId);
  if (draggingRelevant && prev.draggingCardId !== next.draggingCardId) {
    return false;
  }

  return true;
}

const PlayerPanelInner: React.FC<PlayerPanelProps> = ({
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
  const [openZoneDialog, setOpenZoneDialog] = useState<OpenZoneDialog>(null);

  const hand = zones.HAND;
  const battlefield = zones.BATTLEFIELD;
  const graveyard = zones.GRAVEYARD;
  const exile = zones.EXILE;
  const library = zones.LIBRARY;
  const command = zones.COMMAND;

  const { lands, creatures, support } = useMemo(() => {
    const nextLands: CardInstance[] = [];
    const nextCreatures: CardInstance[] = [];
    const nextSupport: CardInstance[] = [];

    for (const card of battlefield) {
      if (card.definition.types.includes(CardType.LAND)) {
        nextLands.push(card);
      } else if (card.definition.types.includes(CardType.CREATURE)) {
        nextCreatures.push(card);
      } else {
        nextSupport.push(card);
      }
    }

    return {
      lands: nextLands,
      creatures: nextCreatures,
      support: nextSupport,
    };
  }, [battlefield]);

  const lifeState = getLifeDanger(player);
  const infoSide = seat.position.endsWith('right') ? 'left' : 'right';

  const handleBattlefieldDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onBattlefieldDrop(player.id);
  };

  const handleBattlefieldDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onBattlefieldDragOver(player.id);
  };

  const dialogSections =
    openZoneDialog === 'GRAVEYARD_EXILE'
      ? [
          { zone: Zone.GRAVEYARD as typeof Zone.GRAVEYARD, cards: graveyard },
          { zone: Zone.EXILE as typeof Zone.EXILE, cards: exile },
        ]
      : [];

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
        <div className="arena-seat__crest" data-avatar-side={seat.position.endsWith('right') ? 'right' : 'left'}>
          <div className="arena-seat__avatar" aria-hidden="true" />
          <div
            className="arena-seat__life"
            data-danger={lifeState.danger}
            data-critical={lifeState.critical}
          >
            {player.life}
            <span className="arena-seat__life-label">{player.name} Life Total</span>
          </div>
        </div>

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
        <CombinedZonePile
          graveyardCount={graveyard.length}
          exileCount={exile.length}
          onClick={() => setOpenZoneDialog('GRAVEYARD_EXILE')}
          registerGraveyardAnchor={(node) => registerZoneAnchor(`${player.id}:GRAVEYARD`, node)}
          registerExileAnchor={(node) => registerZoneAnchor(`${player.id}:EXILE`, node)}
        />

        <HandRail
          playerId={player.id}
          playerName={player.name}
          handHidden={seat.handHidden}
          command={command}
          hand={hand}
          exile={exile}
          graveyard={graveyard}
          legalActions={legalActions}
          previewCardId={previewCardId}
          previewMode={touchFriendly ? 'tap' : 'hover'}
          draggingCardId={draggingCardId}
          onAction={onAction}
          onPreview={onPreview}
          onPreviewClear={onPreviewClear}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          registerCardElement={registerCardElement}
          registerZoneAnchor={registerZoneAnchor}
        />

        <ZonePile
          zone={Zone.LIBRARY}
          count={library.length}
          side="right"
          onClick={
            seat.position === 'bottom-left'
              ? () => setOpenZoneDialog('LIBRARY_EXPLORER')
              : undefined
          }
          registerZoneAnchor={(node) => registerZoneAnchor(`${player.id}:LIBRARY`, node)}
        />
      </div>

      {openZoneDialog === 'GRAVEYARD_EXILE' && (
        <ZoneDialog
          playerName={player.name}
          sections={dialogSections}
          previewCardId={previewCardId}
          touchFriendly={touchFriendly}
          onPreview={onPreview}
          onPreviewClear={onPreviewClear}
          onClose={() => setOpenZoneDialog(null)}
        />
      )}

      {openZoneDialog === 'LIBRARY_EXPLORER' && (
        <CardExplorer
          title={`${player.name} Library`}
          cards={library}
          selectionMode="none"
          dismissable={true}
          onClose={() => setOpenZoneDialog(null)}
          previewCardId={previewCardId}
          onPreview={onPreview}
          onPreviewClear={onPreviewClear}
        />
      )}
    </section>
  );
};

export const PlayerPanel = React.memo(PlayerPanelInner, playerPanelPropsEqual);
