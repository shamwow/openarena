import { useState, useEffect, useCallback, useRef } from 'react';
import { GameEngineImpl, type ChoiceRequest } from '../../engine/GameEngine';
import type { GameState, GameEvent, PlayerAction } from '../../engine/types';
import { ActionType, CardType, Zone } from '../../engine/types';
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

type QaScenario = 'local-offhand-rail' | null;

function getQaScenario(): QaScenario {
  if (typeof window === 'undefined') {
    return null;
  }

  const scenario = new URLSearchParams(window.location.search).get('qaScenario');
  return scenario === 'local-offhand-rail' ? scenario : null;
}

function applyQaScenario(state: GameState, legalActions: PlayerAction[], scenario: QaScenario): PlayerAction[] {
  if (scenario !== 'local-offhand-rail' || state.priorityPlayer !== 'player1') {
    return legalActions;
  }

  const localZones = state.zones.player1;

  if (localZones.EXILE.length === 0 && localZones.GRAVEYARD.length === 0) {
    const movableCards = localZones.HAND.filter(
      (card) => !card.definition.types.includes(CardType.LAND),
    ).slice(0, 2);

    const [exileCard, graveyardCard] = movableCards;
    if (exileCard) {
      localZones.HAND = localZones.HAND.filter((card) => card.objectId !== exileCard.objectId);
      exileCard.zone = Zone.EXILE;
      localZones.EXILE.push(exileCard);
    }
    if (graveyardCard) {
      localZones.HAND = localZones.HAND.filter((card) => card.objectId !== graveyardCard.objectId);
      graveyardCard.zone = Zone.GRAVEYARD;
      localZones.GRAVEYARD.push(graveyardCard);
    }
  }

  const syntheticActions: PlayerAction[] = [localZones.EXILE[0], localZones.GRAVEYARD[0]]
    .filter((card): card is NonNullable<typeof card> => card != null)
    .map((card) => ({
      type: ActionType.CAST_SPELL,
      playerId: 'player1' as const,
      cardId: card.objectId,
    }));

  return [...legalActions, ...syntheticActions];
}

export function useGameEngine(): UseGameEngineReturn {
  const engineRef = useRef<GameEngineImpl | null>(null);
  const qaScenarioRef = useRef<QaScenario>(getQaScenario());
  const [state, setState] = useState<GameState | null>(null);
  const [gameLog, setGameLog] = useState<GameEvent[]>([]);
  const [pendingChoice, setPendingChoice] = useState<ChoiceRequest | null>(null);
  const [legalActions, setLegalActions] = useState<PlayerAction[]>([]);

  const initEngine = useCallback(() => {
    const engine = new GameEngineImpl(prebuiltDecks);
    engineRef.current = engine;

    // Subscribe to state changes
    engine.onStateChange((newState: GameState) => {
      const nextLegalActions = newState.priorityPlayer
        ? engine.getLegalActions(newState.priorityPlayer)
        : [];
      const scenarioActions = applyQaScenario(newState, nextLegalActions, qaScenarioRef.current);
      setState({ ...newState });
      setLegalActions(scenarioActions);
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
    const initialLegalActions = initialState.priorityPlayer
      ? engine.getLegalActions(initialState.priorityPlayer)
      : [];
    const scenarioActions = applyQaScenario(
      initialState,
      initialLegalActions,
      qaScenarioRef.current,
    );
    setState({ ...initialState });
    setLegalActions(scenarioActions);
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
