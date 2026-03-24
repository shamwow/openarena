import { v4 as uuid } from 'uuid';
import type {
  GameState, PlayerId, CardDefinition, CardInstance,
  ManaColor, Zone, PlayerState,
} from './types';
import { Phase, Step, emptyManaPool } from './types';

export interface DeckConfig {
  commander: CardDefinition;
  cards: CardDefinition[];
  playerName: string;
}

export function createInitialGameState(decks: DeckConfig[]): GameState {
  if (decks.length !== 4) {
    throw new Error('Commander requires exactly 4 players');
  }

  const playerIds: PlayerId[] = ['player1', 'player2', 'player3', 'player4'];
  let timestampCounter = 0;

  const players: Record<PlayerId, PlayerState> = {} as Record<PlayerId, PlayerState>;
  const zones: Record<PlayerId, Record<Zone, CardInstance[]>> = {} as Record<PlayerId, Record<Zone, CardInstance[]>>;

  for (let i = 0; i < 4; i++) {
    const pid = playerIds[i];
    const deck = decks[i];

    // Create commander instance
    const commanderInstance = createCardInstance(
      deck.commander, pid, 'COMMAND' as Zone, timestampCounter++
    );

    // Create card instances for the library
    const libraryCards = deck.cards.map(def =>
      createCardInstance(def, pid, 'LIBRARY' as Zone, timestampCounter++)
    );

    // Shuffle library
    shuffleArray(libraryCards);

    // Derive color identity from commander
    const colorIdentity = deck.commander.colorIdentity.length > 0
      ? deck.commander.colorIdentity
      : deriveColorIdentity(deck.commander);

    players[pid] = {
      id: pid,
      name: deck.playerName,
      life: 40,
      manaPool: emptyManaPool(),
      commanderDamageReceived: {},
      commanderTimesCast: {},
      hasPlayedLand: false,
      landsPlayedThisTurn: 0,
      landPlaysAvailable: 1,
      hasLost: false,
      hasConceded: false,
      poisonCounters: 0,
      commanderIds: [commanderInstance.objectId],
      colorIdentity,
      drewFromEmptyLibrary: false,
    };

    zones[pid] = {
      LIBRARY: libraryCards,
      HAND: [],
      BATTLEFIELD: [],
      GRAVEYARD: [],
      EXILE: [],
      STACK: [],
      COMMAND: [commanderInstance],
    };
  }

  return {
    turnNumber: 1,
    activePlayer: playerIds[0],
    currentPhase: Phase.BEGINNING,
    currentStep: Step.UNTAP,
    players,
    turnOrder: [...playerIds],
    zones,
    stack: [],
    combat: null,
    continuousEffects: [],
    replacementEffects: [],
    timestampCounter,
    objectIdCounter: 0,
    eventLog: [],
    priorityPlayer: null,
    passedPriority: new Set(),
    pendingTriggers: [],
    waitingForChoice: false,
    isGameOver: false,
    winner: null,
  };
}

export function createCardInstance(
  definition: CardDefinition,
  owner: PlayerId,
  zone: Zone,
  timestamp: number
): CardInstance {
  return {
    objectId: uuid(),
    definitionId: definition.id,
    definition,
    owner,
    controller: owner,
    zone,
    timestamp,
    tapped: false,
    faceDown: false,
    summoningSick: true,
    counters: {},
    markedDamage: 0,
    attachedTo: null,
    attachments: [],
  };
}

export function drawInitialHands(state: GameState): void {
  for (const pid of state.turnOrder) {
    for (let i = 0; i < 7; i++) {
      drawOneCard(state, pid);
    }
  }
}

export function drawOneCard(state: GameState, player: PlayerId): CardInstance | null {
  const library = state.zones[player].LIBRARY;
  if (library.length === 0) {
    state.players[player].drewFromEmptyLibrary = true;
    return null;
  }
  const card = library.pop()!;
  card.zone = 'HAND' as Zone;
  state.zones[player].HAND.push(card);
  return card;
}

function deriveColorIdentity(card: CardDefinition): ManaColor[] {
  const colors = new Set<ManaColor>();
  const cost = card.manaCost;
  if (cost.W > 0) colors.add('W' as ManaColor);
  if (cost.U > 0) colors.add('U' as ManaColor);
  if (cost.B > 0) colors.add('B' as ManaColor);
  if (cost.R > 0) colors.add('R' as ManaColor);
  if (cost.G > 0) colors.add('G' as ManaColor);
  return Array.from(colors);
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function findCard(state: GameState, objectId: string): CardInstance | undefined {
  for (const pid of state.turnOrder) {
    for (const zoneCards of Object.values(state.zones[pid])) {
      const card = (zoneCards as CardInstance[]).find(c => c.objectId === objectId);
      if (card) return card;
    }
  }
  for (const entry of state.stack) {
    if (entry.cardInstance?.objectId === objectId) return entry.cardInstance;
  }
  return undefined;
}

export function getNextTimestamp(state: GameState): number {
  return state.timestampCounter++;
}
