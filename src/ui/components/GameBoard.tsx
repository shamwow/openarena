import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Zone } from '../../engine/types';
import type { CardInstance, PlayerAction, PlayerId } from '../../engine/types';
import { useGameEngine } from '../hooks/useGameEngine';
import { prefetchCardArt } from '../hooks/useCardArt';
import type {
  BattlefieldEntryAnimation,
  DragCardPayload,
  PreviewCardState,
  RectSnapshot,
} from '../types';
import { BOARD_SEATS, findCardInstance, snapshotCardLocations } from '../utils/gameView';
import { BattlefieldEntryEffects } from './BattlefieldEntryEffects';
import { CardPreview } from './CardPreview';
import { ChoiceModal } from './ChoiceModal';
import { GameLog } from './GameLog';
import { PhaseBar } from './PhaseBar';
import { PlayerPanel } from './PlayerPanel';
import { StackView } from './StackView';

function rectFromNode(node: HTMLElement): RectSnapshot {
  const rect = node.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function getAnchorRect(node: HTMLElement, zone: Zone | 'STACK' | 'UNKNOWN'): RectSnapshot {
  const rect = node.getBoundingClientRect();
  const width = Math.min(rect.width * 0.42, 118);
  const height = width / 0.715;

  let left = rect.left + rect.width / 2 - width / 2;
  let top = rect.top + rect.height / 2 - height / 2;

  if (zone === Zone.HAND) {
    left = rect.left + rect.width * 0.5 - width / 2;
    top = rect.bottom - height - 14;
  } else if (zone === Zone.COMMAND) {
    left = rect.left + 10;
    top = rect.top + 4;
  } else if (zone === 'STACK') {
    top = rect.top + 46;
  }

  return { left, top, width, height };
}

function createPreviewState(
  card: CardInstance,
  state: NonNullable<ReturnType<typeof useGameEngine>['state']>,
): PreviewCardState {
  const seat = BOARD_SEATS.find((entry) => entry.playerId === card.controller) ?? BOARD_SEATS[3];
  return {
    card,
    ownerName: state.players[card.owner]?.name ?? card.owner,
    controllerName: state.players[card.controller]?.name ?? card.controller,
    seat: seat.position,
  };
}

const EMPTY_ACTIONS: PlayerAction[] = [];

export const GameBoard: React.FC = () => {
  const {
    state,
    submitAction,
    legalActions,
    gameLog,
    pendingChoice,
    resolveChoice,
    newGame,
  } = useGameEngine();

  const [showLog, setShowLog] = useState(false);
  const [preview, setPreview] = useState<PreviewCardState | null>(null);
  const [dragPayload, setDragPayload] = useState<DragCardPayload | null>(null);
  const [dropTargetPlayerId, setDropTargetPlayerId] = useState<PlayerId | null>(null);
  const [touchFriendly, setTouchFriendly] = useState(false);
  const [animations, setAnimations] = useState<BattlefieldEntryAnimation[]>([]);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const lastMouseXRef = useRef<number | undefined>(undefined);
  const zoneAnchorsRef = useRef<Record<string, HTMLElement | null>>({});
  const cardNodesRef = useRef<Record<string, HTMLDivElement | null>>({});
  const previousSnapshotRef = useRef<ReturnType<typeof snapshotCardLocations> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(hover: none)');
    const update = () => {
      setTouchFriendly(mediaQuery.matches);
    };

    update();
    mediaQuery.addEventListener('change', update);
    return () => {
      mediaQuery.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }

    const namesToPrefetch = new Set<string>();
    for (const seat of BOARD_SEATS) {
      const seatZones = state.zones[seat.playerId];
      for (const card of seatZones.BATTLEFIELD) {
        if (!card.definition.id.startsWith('token-')) {
          namesToPrefetch.add(card.definition.name);
        }
      }
      for (const card of seatZones.COMMAND) {
        if (!card.definition.id.startsWith('token-')) {
          namesToPrefetch.add(card.definition.name);
        }
      }
      if (!seat.handHidden) {
        for (const card of seatZones.HAND) {
          if (!card.definition.id.startsWith('token-')) {
            namesToPrefetch.add(card.definition.name);
          }
        }
      }
    }

    for (const name of namesToPrefetch) {
      void prefetchCardArt(name);
    }
  }, [state]);

  useEffect(() => {
    if (!state) {
      previousSnapshotRef.current = null;
      return;
    }

    const nextSnapshot = snapshotCardLocations(state);
    const previousSnapshot = previousSnapshotRef.current;
    let frameId: number | null = null;

    if (previousSnapshot) {
      const nextAnimations: BattlefieldEntryAnimation[] = [];

      for (const [objectId, currentLocation] of Object.entries(nextSnapshot)) {
        if (currentLocation.zone !== Zone.BATTLEFIELD) {
          continue;
        }

        const priorLocation = previousSnapshot[objectId];
        if (!priorLocation || priorLocation.zone === Zone.BATTLEFIELD) {
          continue;
        }

        const card = findCardInstance(state, objectId);
        if (!card) {
          continue;
        }

        const startKey =
          priorLocation.zone === 'STACK'
            ? 'STACK'
            : `${priorLocation.playerId}:${priorLocation.zone}`;

        const startNode = zoneAnchorsRef.current[startKey];
        const destinationNode =
          cardNodesRef.current[objectId] ??
          zoneAnchorsRef.current[`${currentLocation.playerId}:BATTLEFIELD`];

        if (!startNode || !destinationNode) {
          continue;
        }

        const startRect = getAnchorRect(startNode, priorLocation.zone);
        const endRect = rectFromNode(destinationNode);
        const sourceSeat = BOARD_SEATS.find((seat) => seat.playerId === priorLocation.playerId);

        nextAnimations.push({
          key: `${objectId}-${Date.now()}`,
          card,
          playerId: currentLocation.playerId,
          sourceZone: priorLocation.zone,
          hiddenSource: priorLocation.zone === Zone.HAND && (sourceSeat?.handHidden ?? false),
          startRect,
          endRect,
        });
      }

      if (nextAnimations.length > 0) {
        frameId = window.requestAnimationFrame(() => {
          setAnimations((current) => [...current, ...nextAnimations]);
        });
      }
    }

    previousSnapshotRef.current = nextSnapshot;

    return () => {
      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [state]);

  const registerCardElement = useCallback((cardId: string, node: HTMLDivElement | null) => {
    cardNodesRef.current[cardId] = node;
  }, []);

  const registerZoneAnchor = useCallback((key: string, node: HTMLElement | null) => {
    zoneAnchorsRef.current[key] = node;
  }, []);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    lastMouseXRef.current = event.clientX;
  }, []);

  const handlePreview = useCallback(
    (card: CardInstance) => {
      if (!state) {
        return;
      }
      setPreview({ ...createPreviewState(card, state), cursorX: lastMouseXRef.current });
    },
    [state],
  );

  const handlePreviewClear = useCallback((cardId?: string) => {
    setPreview((current) => {
      if (!current) {
        return current;
      }

      if (cardId && current.card.objectId !== cardId) {
        return current;
      }

      return null;
    });
  }, []);

  const handleAction = useCallback(
    (action: PlayerAction) => {
      setDragPayload(null);
      setDropTargetPlayerId(null);
      submitAction(action);
    },
    [submitAction],
  );

  const handleDragStart = useCallback(
    (payload: DragCardPayload) => {
      setDragPayload(payload);
      if (state) {
        setPreview({ ...createPreviewState(payload.card, state), cursorX: lastMouseXRef.current });
      }
    },
    [state],
  );

  const handleDragEnd = useCallback(() => {
    setDragPayload(null);
    setDropTargetPlayerId(null);
    handlePreviewClear();
  }, [handlePreviewClear]);

  const handleNewGame = useCallback(() => {
    setShowSettingsMenu(false);
    setPreview(null);
    setAnimations([]);
    setDragPayload(null);
    setDropTargetPlayerId(null);
    previousSnapshotRef.current = null;
    newGame();
  }, [newGame]);

  const handleToggleLog = useCallback(() => {
    setShowLog((current) => !current);
    setShowSettingsMenu(false);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettingsMenu(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettingsMenu(false);
  }, []);

  const handleBattlefieldDragOver = useCallback(
    (playerId: PlayerId) => {
      if (!dragPayload) {
        return;
      }
      setDropTargetPlayerId(dragPayload.playerId === playerId ? playerId : null);
    },
    [dragPayload],
  );

  const handleBattlefieldDragLeave = useCallback(() => {
    setDropTargetPlayerId(null);
  }, []);

  const handleBattlefieldDrop = useCallback(
    (playerId: PlayerId) => {
      if (!dragPayload || dragPayload.playerId !== playerId) {
        setDropTargetPlayerId(null);
        return;
      }

      setDropTargetPlayerId(null);
      submitAction(dragPayload.action);
      setDragPayload(null);
    },
    [dragPayload, submitAction],
  );

  const removeAnimation = useCallback((key: string) => {
    setAnimations((current) => current.filter((animation) => animation.key !== key));
  }, []);

  if (!state) {
    return <div className="arena-board" data-has-top-pane="false" />;
  }

  const hasPreview = preview !== null;
  const hasStackContent = state.stack.length > 0;
  const hasTopPane = hasPreview || hasStackContent;

  const PREVIEW_FLIP_THRESHOLD = 350;
  const previewSide =
    hasPreview && preview.cursorX != null && preview.cursorX < PREVIEW_FLIP_THRESHOLD
      ? 'right'
      : 'left';

  return (
    <div
      className="arena-board"
      data-has-top-pane={hasTopPane}
      data-preview-side={hasPreview ? previewSide : undefined}
      onMouseMove={handleMouseMove}
    >
      {hasPreview ? <CardPreview preview={preview} /> : null}

      <div className="arena-board__grid">
        {BOARD_SEATS.map((seat) => {
          const seatLegalActions =
            state.priorityPlayer === seat.playerId ? legalActions : EMPTY_ACTIONS;

          return (
            <div key={seat.playerId} className="arena-grid-seat">
              <PlayerPanel
                seat={seat}
                player={state.players[seat.playerId]}
                zones={state.zones[seat.playerId]}
                isActivePlayer={state.activePlayer === seat.playerId}
                hasPriority={state.priorityPlayer === seat.playerId}
                legalActions={seatLegalActions}
                onAction={handleAction}
                onPreview={handlePreview}
                onPreviewClear={handlePreviewClear}
                previewCardId={preview?.card.objectId ?? null}
                touchFriendly={touchFriendly}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                draggingCardId={dragPayload?.card.objectId ?? null}
                isDropActive={dropTargetPlayerId === seat.playerId}
                onBattlefieldDragOver={handleBattlefieldDragOver}
                onBattlefieldDragLeave={handleBattlefieldDragLeave}
                onBattlefieldDrop={handleBattlefieldDrop}
                registerCardElement={registerCardElement}
                registerZoneAnchor={registerZoneAnchor}
              />
            </div>
          );
        })}
      </div>

      <div className="arena-board__hud">
        <div
          className="arena-stack"
          ref={(node) => registerZoneAnchor('STACK', node)}
          data-visible={hasStackContent}
          aria-hidden={!hasStackContent}
        >
          {hasStackContent ? <StackView stack={state.stack} state={state} /> : null}
        </div>

        {state.combat && (
          <div className="arena-combat-banner">
            <div className="arena-combat-banner__title">Combat</div>
            <div className="arena-preview__meta" style={{ marginTop: 6 }}>
              {state.combat.attackers.size} attacker(s) · {state.combat.blockers.size} blocker(s)
            </div>
          </div>
        )}

        <PhaseBar
          state={state}
          legalActions={legalActions}
          onAction={handleAction}
          onOpenSettings={handleOpenSettings}
        />

        {showLog && <GameLog events={gameLog} state={state} />}
      </div>

      {showSettingsMenu && (
        <div className="arena-settings-modal" onClick={handleCloseSettings}>
          <div
            className="arena-settings-modal__panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="arena-settings-modal__title">Match Settings</div>
            <div className="arena-settings-modal__actions">
              <button className="arena-settings-option" onClick={handleNewGame}>
                New Game
              </button>
              <button className="arena-settings-option" onClick={handleToggleLog}>
                {showLog ? 'Hide Log' : 'Show Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BattlefieldEntryEffects
        animations={animations}
        onAnimationEnd={removeAnimation}
      />

      {pendingChoice && (
        <ChoiceModal choice={pendingChoice} onResolve={resolveChoice} />
      )}
    </div>
  );
};
