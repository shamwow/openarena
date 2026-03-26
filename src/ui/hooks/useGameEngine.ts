import { useState, useEffect, useCallback, useRef } from 'react';
import { GameEngineImpl, type ChoiceRequest } from '../../engine/GameEngine';
import type { GameState, GameEvent, PlayerAction } from '../../engine/types';
import { prebuiltDecks } from '../../cards/decks';

export interface UseGameEngineReturn {
  state: GameState | null;
  submitAction: (action: PlayerAction) => void;
  legalActions: PlayerAction[];
  gameLog: GameEvent[];
  pendingChoice: ChoiceRequest | null;
  resolveChoice: (result: unknown) => void;
  newGame: () => void;
}

function getRequestedTestGameStateId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get('test-game-state')?.trim();
  return value ? value : null;
}

async function resolveEngine(): Promise<GameEngineImpl> {
  if (!import.meta.env.DEV) {
    return new GameEngineImpl({ decks: prebuiltDecks });
  }

  const testGameStateId = getRequestedTestGameStateId();
  if (!testGameStateId) {
    return new GameEngineImpl({ decks: prebuiltDecks });
  }

  const { getTestGameState, listTestGameStateIds } = await import('../../testing/testGameStates');
  const definition = getTestGameState(testGameStateId);
  if (!definition) {
    console.warn(
      `Unknown test-game-state "${testGameStateId}". Available ids: ${listTestGameStateIds().join(', ') || '(none)'}.`,
    );
    return new GameEngineImpl({ decks: prebuiltDecks });
  }

  return new GameEngineImpl({ initialState: definition.build() });
}

export function useGameEngine(): UseGameEngineReturn {
  const engineRef = useRef<GameEngineImpl | null>(null);
  const engineCleanupRef = useRef<(() => void) | null>(null);
  const initSequenceRef = useRef(0);
  const [state, setState] = useState<GameState | null>(null);
  const [gameLog, setGameLog] = useState<GameEvent[]>([]);
  const [pendingChoice, setPendingChoice] = useState<ChoiceRequest | null>(null);
  const [legalActions, setLegalActions] = useState<PlayerAction[]>([]);

  const syncFromEngine = useCallback((engine: GameEngineImpl, nextState: GameState) => {
    if (engineRef.current !== engine) {
      return;
    }

    const nextLegalActions = nextState.priorityPlayer
      ? engine.getLegalActions(nextState.priorityPlayer)
      : [];

    setState({ ...nextState });
    setLegalActions(nextLegalActions);
  }, []);

  const teardownEngine = useCallback(() => {
    initSequenceRef.current += 1;
    engineCleanupRef.current?.();
    engineCleanupRef.current = null;
    engineRef.current = null;
  }, []);

  const initEngine = useCallback(async () => {
    teardownEngine();
    const initSequence = initSequenceRef.current;

    const engine = await resolveEngine();
    if (initSequence !== initSequenceRef.current) {
      return;
    }

    engineRef.current = engine;
    const cleanups: Array<() => void> = [];

    cleanups.push(
      engine.onStateChange((newState: GameState) => {
        syncFromEngine(engine, newState);
      }),
    );

    cleanups.push(
      engine.onGameLog((event: GameEvent) => {
        if (engineRef.current !== engine) {
          return;
        }
        setGameLog((prev) => [...prev, event]);
      }),
    );

    cleanups.push(
      engine.onChoiceRequest((req: ChoiceRequest) => {
        if (engineRef.current !== engine) {
          return;
        }
        setPendingChoice(req);
      }),
    );

    engineCleanupRef.current = () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };

    syncFromEngine(engine, engine.getState());
  }, [syncFromEngine, teardownEngine]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        void initEngine();
      }
    });

    return () => {
      cancelled = true;
      teardownEngine();
    };
  }, [initEngine, teardownEngine]);

  const submitAction = useCallback((action: PlayerAction) => {
    if (engineRef.current) {
      engineRef.current.submitAction(action);
    }
  }, []);

  const resolveChoice = useCallback((result: unknown) => {
    if (pendingChoice) {
      pendingChoice.resolve(result);
      setPendingChoice(null);
    }
  }, [pendingChoice]);

  const newGame = useCallback(() => {
    setState(null);
    setGameLog([]);
    setPendingChoice(null);
    setLegalActions([]);
    void initEngine();
  }, [initEngine]);

  return {
    state,
    submitAction,
    legalActions,
    gameLog,
    pendingChoice,
    resolveChoice,
    newGame,
  };
}
