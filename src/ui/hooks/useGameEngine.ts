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

export function useGameEngine(): UseGameEngineReturn {
  const engineRef = useRef<GameEngineImpl | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [gameLog, setGameLog] = useState<GameEvent[]>([]);
  const [pendingChoice, setPendingChoice] = useState<ChoiceRequest | null>(null);
  const [legalActions, setLegalActions] = useState<PlayerAction[]>([]);

  const initEngine = useCallback(() => {
    const engine = new GameEngineImpl(prebuiltDecks);
    engineRef.current = engine;

    // Subscribe to state changes
    engine.onStateChange((newState: GameState) => {
      setState({ ...newState });
      // Recompute legal actions for the priority player
      if (newState.priorityPlayer) {
        setLegalActions(engine.getLegalActions(newState.priorityPlayer));
      } else {
        setLegalActions([]);
      }
    });

    // Subscribe to game log events
    engine.onGameLog((event: GameEvent) => {
      setGameLog((prev) => [...prev, event]);
    });

    // Subscribe to choice requests
    engine.onChoiceRequest((req: ChoiceRequest) => {
      setPendingChoice(req);
    });

    // Set initial state
    const initialState = engine.getState();
    setState({ ...initialState });
    if (initialState.priorityPlayer) {
      setLegalActions(engine.getLegalActions(initialState.priorityPlayer));
    }
  }, []);

  useEffect(() => {
    initEngine();
  }, [initEngine]);

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
    setGameLog([]);
    setPendingChoice(null);
    setLegalActions([]);
    initEngine();
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
