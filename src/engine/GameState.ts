import { v4 as uuid } from 'uuid';
import type {
  GameState, PlayerId, CardDefinition, CardInstance,
  LastKnownInformation, ManaColor, Zone, PlayerState, CardType,
} from './types';
import { Phase, Step, emptyManaPool } from './types';

export interface DeckConfig {
  commander: CardDefinition;
  commanders?: CardDefinition[];
  cards: CardDefinition[];
  playerName: string;
}

export interface BaseGameStateOptions {
  shuffleLibraries?: boolean;
}

export function createBaseGameState(
  decks: DeckConfig[],
  options: BaseGameStateOptions = {},
): GameState {
  if (decks.length !== 4) {
    throw new Error('Commander requires exactly 4 players');
  }

  const { shuffleLibraries = false } = options;
  const playerIds: PlayerId[] = ['player1', 'player2', 'player3', 'player4'];
  let timestampCounter = 0;

  const players: Record<PlayerId, PlayerState> = {} as Record<PlayerId, PlayerState>;
  const zones: Record<PlayerId, Record<Zone, CardInstance[]>> = {} as Record<PlayerId, Record<Zone, CardInstance[]>>;

  for (let i = 0; i < 4; i++) {
    const pid = playerIds[i];
    const deck = decks[i];
    const commanders = resolveDeckCommanders(deck);

    // Create commander instances
    const commanderInstances = commanders.map(commander =>
      createCardInstance(commander, pid, 'COMMAND', timestampCounter++)
    );

    // Create card instances for the library
    const libraryCards = deck.cards.map(def =>
      createCardInstance(def, pid, 'LIBRARY', timestampCounter++)
    );

    if (shuffleLibraries) {
      shuffleArray(libraryCards);
    }

    // Derive color identity from all commanders
    const colorIdentity = deriveCommanderColorIdentity(commanders);

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
      commanderIds: commanderInstances.map(commander => commander.cardId),
      colorIdentity,
      drewFromEmptyLibrary: false,
      trackedMana: [],
      spellsCastThisTurn: 0,
      experienceCounters: 0,
      energyCounters: 0,
    };

    zones[pid] = {
      LIBRARY: libraryCards,
      HAND: [],
      BATTLEFIELD: [],
      GRAVEYARD: [],
      EXILE: [],
      STACK: [],
      COMMAND: commanderInstances,
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
    wouldEnterBattlefieldReplacementEffects: [],
    interactionHooks: [],
    exileInsteadOfDyingThisTurn: new Set(),
    lastKnownInformation: {},
    timestampCounter,
    objectIdCounter: 0,
    eventLog: [],
    priorityPlayer: null,
    passedPriority: new Set(),
    pendingTriggers: [],
    delayedTriggers: [],
    castPermissions: [],
    waitingForChoice: false,
    isGameOver: false,
    winner: null,
    loyaltyAbilitiesUsedThisTurn: [],
    triggeredAbilitiesUsedThisTurn: new Set<string>(),
    pendingFreeCasts: [],
    pendingExtraTurns: [],
    pendingExtraCombatPhases: [],
    currentCombatAttackRestriction: null,
  };
}

export function createInitialGameState(decks: DeckConfig[]): GameState {
  return createBaseGameState(decks, { shuffleLibraries: true });
}

export function createCardInstance(
  definition: CardDefinition,
  owner: PlayerId,
  zone: Zone,
  timestamp: number
): CardInstance {
  const cardId = uuid();
  return {
    cardId,
    objectId: cardId,
    zoneChangeCounter: 0,
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
    isToken: false,
    exhaustedAbilityZoneChangeCounters: {},
  };
}

export function cloneCardInstance(card: CardInstance): CardInstance {
  return {
    ...card,
    counters: { ...card.counters },
    attachments: [...card.attachments],
    exhaustedAbilityZoneChangeCounters: card.exhaustedAbilityZoneChangeCounters
      ? { ...card.exhaustedAbilityZoneChangeCounters }
      : undefined,
    modifiedTypes: card.modifiedTypes ? [...card.modifiedTypes] : undefined,
    modifiedSubtypes: card.modifiedSubtypes ? [...card.modifiedSubtypes] : undefined,
    modifiedSupertypes: card.modifiedSupertypes ? [...card.modifiedSupertypes] : undefined,
    modifiedAbilities: card.modifiedAbilities ? [...card.modifiedAbilities] : undefined,
    attackTaxes: card.attackTaxes ? card.attackTaxes.map(tax => ({
      sourceId: tax.sourceId,
      defender: tax.defender,
      cost: {
        ...tax.cost,
        mana: tax.cost.mana ? { ...tax.cost.mana } : undefined,
      },
    })) : undefined,
  };
}

export function getObjectInstanceKey(objectId: string, zoneChangeCounter: number): string {
  return `${objectId}:${zoneChangeCounter}`;
}

export function markExileInsteadOfDyingThisTurn(
  state: GameState,
  objectId: string,
  zoneChangeCounter: number,
): void {
  state.exileInsteadOfDyingThisTurn.add(getObjectInstanceKey(objectId, zoneChangeCounter));
}

export function shouldExileInsteadOfDyingThisTurn(
  state: GameState,
  objectId: string,
  zoneChangeCounter: number,
): boolean {
  const card = findCard(state, objectId, zoneChangeCounter);
  if (card?.exileInsteadOfDyingThisTurnZoneChangeCounter === zoneChangeCounter) {
    return true;
  }

  return state.exileInsteadOfDyingThisTurn.has(getObjectInstanceKey(objectId, zoneChangeCounter));
}

export function clearExileInsteadOfDyingThisTurn(
  state: GameState,
  objectId?: string,
  zoneChangeCounter?: number,
): void {
  if (objectId === undefined) {
    state.exileInsteadOfDyingThisTurn.clear();
    for (const pid of state.turnOrder) {
      for (const zone of Object.keys(state.zones[pid]) as Zone[]) {
        for (const card of state.zones[pid][zone]) {
          delete card.exileInsteadOfDyingThisTurnZoneChangeCounter;
        }
      }
    }
    for (const entry of state.stack) {
      if (entry.cardInstance) {
        delete entry.cardInstance.exileInsteadOfDyingThisTurnZoneChangeCounter;
      }
    }
    return;
  }

  if (zoneChangeCounter === undefined) {
    for (const key of [...state.exileInsteadOfDyingThisTurn]) {
      if (key.startsWith(`${objectId}:`)) {
        state.exileInsteadOfDyingThisTurn.delete(key);
      }
    }
    for (const pid of state.turnOrder) {
      for (const zone of Object.keys(state.zones[pid]) as Zone[]) {
        for (const card of state.zones[pid][zone]) {
          if (card.objectId === objectId) {
            delete card.exileInsteadOfDyingThisTurnZoneChangeCounter;
          }
        }
      }
    }
    for (const entry of state.stack) {
      if (entry.cardInstance?.objectId === objectId) {
        delete entry.cardInstance.exileInsteadOfDyingThisTurnZoneChangeCounter;
      }
    }
    return;
  }

  state.exileInsteadOfDyingThisTurn.delete(getObjectInstanceKey(objectId, zoneChangeCounter));
  const card = findCard(state, objectId, zoneChangeCounter);
  if (card?.exileInsteadOfDyingThisTurnZoneChangeCounter === zoneChangeCounter) {
    delete card.exileInsteadOfDyingThisTurnZoneChangeCounter;
  }
}

export function getEffectiveTypes(card: CardInstance): CardType[] {
  return card.modifiedTypes ?? card.definition.types;
}

export function getEffectiveAbilities(card: CardInstance): import('./types').AbilityDefinition[] {
  return card.modifiedAbilities ?? card.definition.abilities;
}

export function getEffectiveSubtypes(card: CardInstance): string[] {
  return card.modifiedSubtypes ?? card.definition.subtypes;
}

export function getEffectiveSupertypes(card: CardInstance): string[] {
  return card.modifiedSupertypes ?? card.definition.supertypes;
}

export function hasType(card: CardInstance, type: CardType): boolean {
  return getEffectiveTypes(card).includes(type);
}

export function hasSubtype(card: CardInstance, subtype: string): boolean {
  return getEffectiveSubtypes(card).includes(subtype);
}

export function rememberLastKnownInformation(state: GameState, card: CardInstance): LastKnownInformation {
  const snapshot = cloneCardInstance(card);
  state.lastKnownInformation[getObjectInstanceKey(card.objectId, card.zoneChangeCounter)] = snapshot;
  return snapshot;
}

export function getLastKnownInformation(
  state: GameState,
  objectId: string,
  zoneChangeCounter: number | undefined,
): LastKnownInformation | undefined {
  if (zoneChangeCounter === undefined) return undefined;
  return state.lastKnownInformation[getObjectInstanceKey(objectId, zoneChangeCounter)];
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
  card.zone = 'HAND';
  state.zones[player].HAND.push(card);
  return card;
}

function deriveColorIdentity(card: CardDefinition): ManaColor[] {
  const colors = new Set<ManaColor>();
  const cost = card.spellCost.mana;
  if (cost.W > 0) colors.add('W' as ManaColor);
  if (cost.U > 0) colors.add('U' as ManaColor);
  if (cost.B > 0) colors.add('B' as ManaColor);
  if (cost.R > 0) colors.add('R' as ManaColor);
  if (cost.G > 0) colors.add('G' as ManaColor);
  return Array.from(colors);
}

function deriveCommanderColorIdentity(commanders: CardDefinition[]): ManaColor[] {
  const colors = new Set<ManaColor>();
  for (const commander of commanders) {
    const identity = commander.colorIdentity.length > 0
      ? commander.colorIdentity
      : deriveColorIdentity(commander);
    for (const color of identity) {
      colors.add(color);
    }
  }
  return Array.from(colors);
}

function resolveDeckCommanders(deck: DeckConfig): CardDefinition[] {
  const commanders = deck.commanders?.length ? deck.commanders : [deck.commander];
  if (commanders.length === 0 || commanders.length > 2) {
    throw new Error(`Deck "${deck.playerName}" must have one or two commanders.`);
  }
  if (commanders.length === 2 && !isLegalCommanderPair(commanders[0], commanders[1])) {
    throw new Error(
      `Deck "${deck.playerName}" has an illegal commander pair: ${commanders[0].name} / ${commanders[1].name}.`
    );
  }
  return commanders;
}

function isLegalCommanderPair(first: CardDefinition, second: CardDefinition): boolean {
  if (first.commanderOptions?.partner && second.commanderOptions?.partner) return true;
  if (first.commanderOptions?.friendsForever && second.commanderOptions?.friendsForever) return true;

  const firstPartnerWith = first.commanderOptions?.partnerWith;
  const secondPartnerWith = second.commanderOptions?.partnerWith;
  if (firstPartnerWith && secondPartnerWith) {
    const firstMatches = firstPartnerWith === second.id || firstPartnerWith === second.name;
    const secondMatches = secondPartnerWith === first.id || secondPartnerWith === first.name;
    if (firstMatches && secondMatches) return true;
  }

  const firstChoosesBackground = first.commanderOptions?.chooseABackground ?? false;
  const secondChoosesBackground = second.commanderOptions?.chooseABackground ?? false;
  if ((firstChoosesBackground && isBackground(second)) || (secondChoosesBackground && isBackground(first))) {
    return true;
  }

  return false;
}

function isBackground(card: CardDefinition): boolean {
  return card.subtypes.includes('Background');
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function findCard(
  state: GameState,
  objectId: string,
  zoneChangeCounter?: number,
): CardInstance | undefined {
  for (const pid of state.turnOrder) {
    for (const zoneCards of Object.values(state.zones[pid])) {
      const card = (zoneCards as CardInstance[]).find(c =>
        c.objectId === objectId &&
        (zoneChangeCounter === undefined || c.zoneChangeCounter === zoneChangeCounter)
      );
      if (card) return card;
    }
  }
  for (const entry of state.stack) {
    if (
      entry.cardInstance?.objectId === objectId &&
      (zoneChangeCounter === undefined || entry.cardInstance.zoneChangeCounter === zoneChangeCounter)
    ) {
      return entry.cardInstance;
    }
  }
  return undefined;
}

export function getNextTimestamp(state: GameState): number {
  return state.timestampCounter++;
}
