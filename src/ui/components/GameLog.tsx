import React, { useEffect, useRef } from 'react';
import type { GameEvent, GameState, PlayerId } from '../../engine/types';
import { GameEventType } from '../../engine/types';
import { findCardName } from '../utils/gameView';

interface GameLogProps {
  events: GameEvent[];
  state: GameState | null;
}

function getPlayerName(state: GameState | null, playerId: PlayerId): string {
  if (!state) {
    return playerId;
  }
  return state.players[playerId]?.name ?? playerId;
}

function formatEvent(event: GameEvent, state: GameState | null): string | null {
  const ev = event as unknown as Record<string, unknown>;
  const eventType = event.type as string;

  switch (eventType) {
    case GameEventType.TURN_START: {
      const turnNumber = ev.turnNumber as number | undefined;
      const activePlayer = ev.activePlayer as PlayerId | undefined;
      if (turnNumber == null || activePlayer == null) {
        return null;
      }
      return `Turn ${turnNumber} begins for ${getPlayerName(state, activePlayer)}.`;
    }

    case GameEventType.STEP_CHANGE:
      return `${String(ev.phase)} / ${String(ev.step)}`;

    case GameEventType.SPELL_CAST: {
      const castBy = ev.castBy as PlayerId | undefined;
      const objectId = ev.objectId as string | undefined;
      if (!state || castBy == null || objectId == null) {
        return null;
      }
      return `${getPlayerName(state, castBy)} cast ${findCardName(state, objectId)}.`;
    }

    case GameEventType.ENTERS_BATTLEFIELD: {
      const controller = ev.controller as PlayerId | undefined;
      const objectId = ev.objectId as string | undefined;
      if (!state || controller == null || objectId == null) {
        return null;
      }
      return `${findCardName(state, objectId)} entered under ${getPlayerName(state, controller)}.`;
    }

    case GameEventType.LEAVES_BATTLEFIELD: {
      const objectId = ev.objectId as string | undefined;
      const destination = ev.destination as string | undefined;
      if (!state || objectId == null || destination == null) {
        return null;
      }
      return `${findCardName(state, objectId)} left for ${destination}.`;
    }

    case GameEventType.DAMAGE_DEALT: {
      const sourceId = ev.sourceId as string | undefined;
      const targetId = ev.targetId as string | undefined;
      const amount = ev.amount as number | undefined;
      if (!state || sourceId == null || targetId == null || amount == null) {
        return null;
      }
      const targetName = targetId.startsWith('player')
        ? getPlayerName(state, targetId as PlayerId)
        : findCardName(state, targetId);
      return `${findCardName(state, sourceId)} dealt ${amount} damage to ${targetName}.`;
    }

    case GameEventType.LIFE_GAINED:
      return `${getPlayerName(state, ev.player as PlayerId)} gained ${String(ev.amount)} life.`;

    case GameEventType.LIFE_LOST:
      return `${getPlayerName(state, ev.player as PlayerId)} lost ${String(ev.amount)} life.`;

    case GameEventType.DREW_CARD:
      return `${getPlayerName(state, ev.player as PlayerId)} drew a card.`;

    case GameEventType.DISCARDED:
      return `${getPlayerName(state, ev.player as PlayerId)} discarded ${findCardName(state!, ev.objectId as string)}.`;

    case GameEventType.ATTACKS:
      return `${findCardName(state!, ev.attackerId as string)} attacks ${getPlayerName(state, ev.defendingPlayer as PlayerId)}.`;

    case GameEventType.BLOCKS:
      return `${findCardName(state!, ev.blockerId as string)} blocks ${findCardName(state!, ev.attackerId as string)}.`;

    case GameEventType.ABILITY_ACTIVATED:
      return `${findCardName(state!, ev.sourceId as string)} activated an ability.`;

    case GameEventType.ABILITY_TRIGGERED:
      return `${findCardName(state!, ev.sourceId as string)} triggered.`;

    case GameEventType.COUNTER_ADDED:
      return `${findCardName(state!, ev.objectId as string)} received ${String(ev.amount)} ${String(ev.counterType)} counter(s).`;

    case GameEventType.PLAYER_LOST:
      return `${getPlayerName(state, ev.player as PlayerId)} lost the game.`;

    case GameEventType.PLAYER_WON:
      return `${getPlayerName(state, ev.player as PlayerId)} wins the game.`;

    case GameEventType.SPELL_COUNTERED:
      return `A spell was countered.`;

    case GameEventType.DESTROYED:
      return `${findCardName(state!, ev.objectId as string)} was destroyed.`;

    case GameEventType.SACRIFICED:
      return `${getPlayerName(state, ev.controller as PlayerId)} sacrificed ${findCardName(state!, ev.objectId as string)}.`;

    case GameEventType.EXILED:
      return `${findCardName(state!, ev.objectId as string)} was exiled.`;

    default:
      return null;
  }
}

function getEventColor(eventType: string): string {
  switch (eventType) {
    case GameEventType.TURN_START:
      return '#f7d488';
    case GameEventType.SPELL_CAST:
      return '#97d1ff';
    case GameEventType.DAMAGE_DEALT:
      return '#ff927a';
    case GameEventType.LIFE_GAINED:
      return '#7add9c';
    case GameEventType.LIFE_LOST:
      return '#ff9078';
    case GameEventType.ENTERS_BATTLEFIELD:
      return '#bfdba1';
    default:
      return '#d3c4a4';
  }
}

export const GameLog: React.FC<GameLogProps> = ({ events, state }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [events.length]);

  const formattedEntries = events
    .map((event, index) => {
      const text = formatEvent(event, state);
      if (!text) {
        return null;
      }
      return {
        key: `${event.type}-${index}`,
        color: getEventColor(event.type as string),
        text,
      };
    })
    .filter((entry): entry is { key: string; color: string; text: string } => entry != null);

  return (
    <aside className="arena-log">
      <div className="arena-log__title">Match Log</div>
      <div ref={scrollRef} className="arena-log__body">
        {formattedEntries.length === 0 ? (
          <div className="arena-preview__meta">No actions recorded yet.</div>
        ) : (
          formattedEntries.map((entry) => (
            <div
              key={entry.key}
              className="arena-log__entry"
              style={{ color: entry.color }}
            >
              {entry.text}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
