// ============================================================
// OpenArena — MTG Commander Game Engine Core Types
// ============================================================

// --- Identifiers ---

export type PlayerId = 'player1' | 'player2' | 'player3' | 'player4';
export type ObjectId = string; // UUID for every game object
export type Timestamp = number; // Monotonically increasing

// --- Tagged constants ---

export const Phase = {
  BEGINNING: 'BEGINNING',
  PRECOMBAT_MAIN: 'PRECOMBAT_MAIN',
  COMBAT: 'COMBAT',
  POSTCOMBAT_MAIN: 'POSTCOMBAT_MAIN',
  ENDING: 'ENDING',
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

export const Step = {
  UNTAP: 'UNTAP',
  UPKEEP: 'UPKEEP',
  DRAW: 'DRAW',
  MAIN: 'MAIN',
  BEGINNING_OF_COMBAT: 'BEGINNING_OF_COMBAT',
  DECLARE_ATTACKERS: 'DECLARE_ATTACKERS',
  DECLARE_BLOCKERS: 'DECLARE_BLOCKERS',
  FIRST_STRIKE_DAMAGE: 'FIRST_STRIKE_DAMAGE',
  COMBAT_DAMAGE: 'COMBAT_DAMAGE',
  END_OF_COMBAT: 'END_OF_COMBAT',
  END: 'END',
  CLEANUP: 'CLEANUP',
} as const;
export type Step = (typeof Step)[keyof typeof Step];

export const Zone = {
  LIBRARY: 'LIBRARY',
  HAND: 'HAND',
  BATTLEFIELD: 'BATTLEFIELD',
  GRAVEYARD: 'GRAVEYARD',
  EXILE: 'EXILE',
  STACK: 'STACK',
  COMMAND: 'COMMAND',
} as const;
export type Zone = (typeof Zone)[keyof typeof Zone];

export const ManaColor = {
  WHITE: 'W',
  BLUE: 'U',
  BLACK: 'B',
  RED: 'R',
  GREEN: 'G',
  COLORLESS: 'C',
} as const;
export type ManaColor = (typeof ManaColor)[keyof typeof ManaColor];

export const CardType = {
  CREATURE: 'Creature',
  INSTANT: 'Instant',
  SORCERY: 'Sorcery',
  ENCHANTMENT: 'Enchantment',
  ARTIFACT: 'Artifact',
  PLANESWALKER: 'Planeswalker',
  LAND: 'Land',
  BATTLE: 'Battle',
} as const;
export type CardType = (typeof CardType)[keyof typeof CardType];

export const Keyword = {
  FLYING: 'Flying',
  FIRST_STRIKE: 'First Strike',
  DOUBLE_STRIKE: 'Double Strike',
  TRAMPLE: 'Trample',
  DEATHTOUCH: 'Deathtouch',
  LIFELINK: 'Lifelink',
  VIGILANCE: 'Vigilance',
  HASTE: 'Haste',
  REACH: 'Reach',
  HEXPROOF: 'Hexproof',
  SHROUD: 'Shroud',
  INDESTRUCTIBLE: 'Indestructible',
  MENACE: 'Menace',
  FLASH: 'Flash',
  DEFENDER: 'Defender',
  PROTECTION: 'Protection',
  WARD: 'Ward',
  UNBLOCKABLE: 'Unblockable',
  PHASING: 'Phasing',
  PLAINSWALK: 'Plainswalk',
  ISLANDWALK: 'Islandwalk',
  SWAMPWALK: 'Swampwalk',
  MOUNTAINWALK: 'Mountainwalk',
  FORESTWALK: 'Forestwalk',
} as const;
export type Keyword = (typeof Keyword)[keyof typeof Keyword];

// --- Mana ---

export interface ManaCost {
  generic: number;
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number; // colorless-only (e.g. {C} from Kozilek)
  X: number; // number of X symbols
  hybrid?: string[];
  phyrexian?: ManaColor[];
}

export function emptyManaCost(): ManaCost {
  return {
    generic: 0,
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0,
    X: 0,
    hybrid: [],
    phyrexian: [],
  };
}

/** Parse "{2}{G}{G}" style mana cost strings */
export function parseManaCost(str: string): ManaCost {
  const cost = emptyManaCost();
  const tokens = str.match(/\{[^}]+\}/g) || [];
  for (const token of tokens) {
    const inner = token.slice(1, -1);
    if (inner === 'W') cost.W++;
    else if (inner === 'U') cost.U++;
    else if (inner === 'B') cost.B++;
    else if (inner === 'R') cost.R++;
    else if (inner === 'G') cost.G++;
    else if (inner === 'C') cost.C++;
    else if (inner === 'X') cost.X++;
    else if (inner.endsWith('/P')) {
      const color = inner[0] as ManaColor;
      if (color === 'W' || color === 'U' || color === 'B' || color === 'R' || color === 'G') {
        cost.phyrexian!.push(color);
      }
    } else if (inner.includes('/')) {
      cost.hybrid!.push(inner);
    }
    else {
      const n = parseInt(inner, 10);
      if (!isNaN(n)) cost.generic += n;
    }
  }
  return cost;
}

export function manaCostTotal(cost: ManaCost): number {
  const hybridTotal = (cost.hybrid ?? []).reduce((total, symbol) => {
    if (symbol.startsWith('2/')) {
      return total + 2;
    }
    return total + 1;
  }, 0);
  return cost.generic + cost.W + cost.U + cost.B + cost.R + cost.G + cost.C + hybridTotal + (cost.phyrexian?.length ?? 0);
}

export function manaCostToString(cost: ManaCost): string {
  let s = '';
  for (let i = 0; i < cost.X; i++) s += '{X}';
  if (cost.generic > 0) s += `{${cost.generic}}`;
  for (let i = 0; i < cost.W; i++) s += '{W}';
  for (let i = 0; i < cost.U; i++) s += '{U}';
  for (let i = 0; i < cost.B; i++) s += '{B}';
  for (let i = 0; i < cost.R; i++) s += '{R}';
  for (let i = 0; i < cost.G; i++) s += '{G}';
  for (let i = 0; i < cost.C; i++) s += '{C}';
  for (const symbol of cost.hybrid ?? []) s += `{${symbol}}`;
  for (const color of cost.phyrexian ?? []) s += `{${color}/P}`;
  if (s === '') s = '{0}';
  return s;
}

export interface ManaPool {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number;
}

export function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

export type ManaSymbol = keyof ManaPool;

export interface ManaProduction {
  amount: number;
  colors: ManaSymbol[];
  restrictToColorIdentity?: boolean;
}

export function manaCostColorIdentity(cost: ManaCost): ManaColor[] {
  const colors = new Set<ManaColor>();
  if (cost.W > 0) colors.add(ManaColor.WHITE);
  if (cost.U > 0) colors.add(ManaColor.BLUE);
  if (cost.B > 0) colors.add(ManaColor.BLACK);
  if (cost.R > 0) colors.add(ManaColor.RED);
  if (cost.G > 0) colors.add(ManaColor.GREEN);

  for (const symbol of cost.hybrid ?? []) {
    for (const part of symbol.split('/')) {
      if (part === 'W' || part === 'U' || part === 'B' || part === 'R' || part === 'G') {
        colors.add(part as ManaColor);
      }
    }
  }

  for (const color of cost.phyrexian ?? []) {
    colors.add(color);
  }

  return [...colors];
}

// --- Protection ---

export interface ProtectionFrom {
  colors?: ManaColor[];
  types?: CardType[];
  custom?: (source: CardInstance) => boolean;
}

// --- Alternative/Additional Costs ---

export interface AlternativeCast {
  id: string;
  cost: Cost;
  zone?: Zone;
  afterResolution?: Zone;
  description: string;
}

export interface AdditionalCost {
  id: string;
  cost: Cost;
  optional: boolean;
  description: string;
}

// --- Card Definition (immutable template) ---

export interface CardDefinition {
  id: string;
  name: string;
  manaCost: ManaCost;
  colorIdentity: ManaColor[];
  types: CardType[];
  supertypes: string[];
  subtypes: string[];
  power?: number;
  toughness?: number;
  loyalty?: number;
  abilities: AbilityDefinition[];
  keywords: Keyword[];
  protectionFrom?: ProtectionFrom[];
  wardCost?: Cost;
  attachmentType?: 'Equipment' | 'Aura';
  attachTarget?: TargetSpec;
  waterbend?: number;
  alternativeCosts?: AlternativeCast[];
  additionalCosts?: AdditionalCost[];
  tags?: string[];
  backFace?: CardDefinition;
  isMDFC?: boolean;
  sagaChapters?: Array<{ chapter: number; effect: EffectFn }>;
  totalChapters?: number;
  adventure?: { name: string; manaCost: ManaCost; types: CardType[]; effect: EffectFn };
  splitHalf?: CardDefinition;
  hasFuse?: boolean;
  morphCost?: Cost;
  suspendCost?: Cost;
  suspendTimeCounters?: number;
}

// --- Card Instance (live game object) ---

export interface CardInstance {
  cardId: ObjectId;
  objectId: ObjectId;
  zoneChangeCounter: number;
  definitionId: string;
  definition: CardDefinition;
  owner: PlayerId;
  controller: PlayerId;
  zone: Zone;
  timestamp: Timestamp;

  // Battlefield state
  tapped: boolean;
  faceDown: boolean;
  summoningSick: boolean;
  counters: Record<string, number>;
  markedDamage: number;
  attachedTo: ObjectId | null;
  attachments: ObjectId[];

  // Copy effect (Layer 1): if set, this card copies another card's definition
  copyOf?: ObjectId;

  // Transform / DFC state
  isTransformed?: boolean;

  // Phasing state
  phasedOut?: boolean;

  // Adventure: set when cast as adventure and exiled
  castAsAdventure?: boolean;

  isToken?: boolean;

  // Overrides from continuous effects (computed, not stored permanently)
  modifiedTypes?: CardType[];
  modifiedSubtypes?: string[];
  modifiedSupertypes?: string[];
  modifiedPower?: number;
  modifiedToughness?: number;
  modifiedKeywords?: Keyword[];
  modifiedAbilities?: AbilityDefinition[];
  protectionFrom?: ProtectionFrom[];
  wardCost?: Cost;
  cantBeTargetedByOpponents?: boolean;
  attackTaxes?: AttackTaxRequirement[];
}

export type LastKnownInformation = CardInstance;

export interface AttackTaxRequirement {
  sourceId: ObjectId;
  defender: PlayerId;
  cost: Cost;
}

// --- Abilities ---

export type AbilityDefinition =
  | ActivatedAbilityDef
  | TriggeredAbilityDef
  | StaticAbilityDef
  | SpellAbilityDef
  | ModalAbilityDef;

export interface ActivatedAbilityDef {
  kind: 'activated';
  cost: Cost;
  effect: EffectFn;
  targets?: TargetSpec[];
  timing: 'instant' | 'sorcery';
  isManaAbility: boolean;
  activationZone?: Zone;
  manaProduction?: ManaProduction[];
  description: string;
}

export interface TriggeredAbilityDef {
  kind: 'triggered';
  trigger: TriggerCondition;
  effect: EffectFn;
  targets?: TargetSpec[];
  interveningIf?: (game: GameState, source: CardInstance, event: GameEvent) => boolean;
  optional: boolean;
  description: string;
}

export interface StaticAbilityDef {
  kind: 'static';
  effect: StaticEffectDef;
  condition?: (game: GameState, source: CardInstance) => boolean;
  description: string;
}

export interface SpellAbilityDef {
  kind: 'spell';
  effect: EffectFn;
  targets?: TargetSpec[];
  description: string;
}

export interface ModalAbilityDef {
  kind: 'modal';
  modes: Array<{ label: string; effect: EffectFn; targets?: TargetSpec[] }>;
  chooseCount: number;
  description: string;
}

// --- Costs ---

export interface Cost {
  mana?: ManaCost;
  tap?: boolean;
  genericTapSubstitution?: GenericTapSubstitution;
  sacrifice?: CardFilter;
  discard?: CardFilter | number; // filter or "discard N cards"
  payLife?: number;
  exileFromGraveyard?: CardFilter | number;
  removeCounters?: { type: string; count: number };
  custom?: (game: GameState, source: CardInstance, player: PlayerId) => boolean;
}

export interface GenericTapSubstitution {
  amount: number;
  filter: CardFilter;
  ignoreSummoningSickness?: boolean;
}

// --- Triggers ---

export type TriggerCondition =
  | { on: 'enter-battlefield'; filter?: CardFilter }
  | { on: 'leave-battlefield'; filter?: CardFilter; destination?: Zone }
  | { on: 'cast-spell'; filter?: SpellFilter }
  | { on: 'dies'; filter?: CardFilter }
  | { on: 'attacks'; filter?: CardFilter }
  | { on: 'blocks'; filter?: CardFilter }
  | { on: 'deals-damage'; filter?: CardFilter; damageType?: 'combat' | 'noncombat' | 'any' }
  | { on: 'dealt-damage'; filter?: CardFilter }
  | { on: 'upkeep'; whose?: 'yours' | 'each' | 'opponents' }
  | { on: 'end-step'; whose?: 'yours' | 'each' }
  | { on: 'draw-card'; whose?: 'yours' | 'opponents' | 'any' }
  | { on: 'tap'; filter?: CardFilter }
  | { on: 'untap'; filter?: CardFilter }
  | { on: 'gain-life'; whose?: 'yours' | 'opponents' | 'any' }
  | { on: 'lose-life'; whose?: 'yours' | 'opponents' | 'any' }
  | { on: 'counter-placed'; counterType?: string; filter?: CardFilter }
  | { on: 'discard'; whose?: 'yours' | 'opponents' | 'any' }
  | { on: 'landfall'; whose?: 'yours' | 'opponents' | 'any' }
  | { on: 'phase'; phase: Phase }
  | { on: 'step'; step: Step }
  | { on: 'custom'; match: (event: GameEvent, source: CardInstance, game: GameState) => boolean };

export interface CardFilter {
  types?: CardType[];
  subtypes?: string[];
  supertypes?: string[];
  colors?: ManaColor[];
  keywords?: Keyword[];
  controller?: 'you' | 'opponent' | 'any';
  name?: string;
  self?: boolean;
  power?: { op: 'lte' | 'gte' | 'eq'; value: number };
  toughness?: { op: 'lte' | 'gte' | 'eq'; value: number };
  tapped?: boolean;
  isToken?: boolean;
  custom?: (card: CardInstance, game: GameState) => boolean;
}

export type SpellFilter = CardFilter;

// --- Targeting ---

export interface TargetSpec {
  what: 'creature' | 'player' | 'permanent' | 'spell' | 'card-in-graveyard'
    | 'creature-or-player' | 'creature-or-planeswalker' | 'planeswalker' | 'any';
  filter?: CardFilter;
  zone?: Zone;
  count: number;
  upTo?: boolean; // "up to N" means optional
  controller?: 'you' | 'opponent' | 'any';
  custom?: (candidate: CardInstance | PlayerId, game: GameState) => boolean;
}

// --- Effects ---

export type EffectFn = (ctx: EffectContext) => void | Promise<void>;

export interface EffectContext {
  game: GameEngine;
  state: GameState;
  source: CardInstance;
  controller: PlayerId;
  targets: (CardInstance | PlayerId)[];
  event?: GameEvent;
  choices: ChoiceHelper;
  xValue?: number;
  castMethod?: string;
  additionalCostsPaid?: string[];

  /** Choose a single target matching the spec. Returns null if no legal targets exist. */
  chooseTarget(spec: Omit<TargetSpec, 'count'>): Promise<CardInstance | PlayerId | null>;
  /** Choose multiple targets matching the spec. Returns empty array if no legal targets exist. */
  chooseTargets(spec: TargetSpec): Promise<(CardInstance | PlayerId)[]>;
}

export interface ChoiceHelper {
  chooseOne<T>(prompt: string, options: T[], labelFn?: (t: T) => string): Promise<T>;
  chooseN<T>(prompt: string, options: T[], n: number, labelFn?: (t: T) => string): Promise<T[]>;
  chooseUpToN<T>(prompt: string, options: T[], n: number, labelFn?: (t: T) => string): Promise<T[]>;
  chooseYesNo(prompt: string): Promise<boolean>;
  chooseTargets(spec: TargetSpec): Promise<(CardInstance | PlayerId)[]>;
  orderObjects<T>(prompt: string, objects: T[], labelFn?: (t: T) => string): Promise<T[]>;
  choosePlayer(prompt: string, options: PlayerId[]): Promise<PlayerId>;
}

export type PredefinedTokenType = 'Treasure' | 'Clue' | 'Food' | 'Blood';

export interface SearchLibraryOptions {
  player: PlayerId;
  chooser?: PlayerId;
  filter: CardFilter;
  destination: Zone;
  count: number;
  optional?: boolean;
  shuffle?: boolean;
  reveal?: boolean;
}

// --- Static Effects ---

export type StaticEffectDef =
  | { type: 'pump'; power: number; toughness: number; filter: CardFilter; duration?: EffectDuration }
  | { type: 'set-base-pt'; power: number; toughness: number; filter: CardFilter }
  | { type: 'add-types'; types: CardType[]; filter: CardFilter }
  | { type: 'grant-keyword'; keyword: Keyword; filter: CardFilter }
  | { type: 'cost-modification'; costDelta: Partial<ManaCost>; filter: SpellFilter }
  | { type: 'attack-tax'; filter: CardFilter; cost: Cost; defender: 'source-controller' }
  | { type: 'cant-attack'; filter: CardFilter }
  | { type: 'cant-block'; filter: CardFilter }
  | { type: 'cant-be-targeted'; by: 'opponents'; filter: CardFilter }
  | { type: 'replacement'; replaces: ReplacementEventType; replace: ReplacementFn }
  | { type: 'prevention'; prevents: 'damage' | 'combat-damage'; filter?: CardFilter }
  | { type: 'custom'; apply: (game: GameState, source: CardInstance) => void };

export type ReplacementEventType =
  | 'deal-damage' | 'create-token' | 'place-counters'
  | 'draw-card' | 'discard' | 'dies' | 'enter-battlefield';

export type ReplacementFn = (
  game: GameState,
  source: CardInstance,
  event: GameEvent
) => GameEvent | null; // null = event prevented

// --- Continuous Effects (Layer System) ---

export const Layer = {
  COPY: 1,
  CONTROL: 2,
  TEXT: 3,
  TYPE: 4,
  COLOR: 5,
  ABILITY: 6,
  PT_CDA: 70,
  PT_SET: 71,
  PT_MODIFY: 72,
  PT_COUNTERS: 73,
  PT_SWITCH: 74,
} as const;
export type Layer = (typeof Layer)[keyof typeof Layer];

export interface ContinuousEffect {
  id: ObjectId;
  sourceId: ObjectId;
  layer: Layer;
  timestamp: Timestamp;
  duration: EffectDuration;
  appliesTo: (permanent: CardInstance, game: GameState) => boolean;
  apply: (permanent: CardInstance, game: GameState) => void;
  dependsOn?: ObjectId[];
}

export type EffectDuration =
  | { type: 'static'; sourceId: ObjectId }
  | { type: 'until-end-of-turn' }
  | { type: 'permanent' }
  | { type: 'while-condition'; check: (gs: GameState) => boolean };

export interface ReplacementEffect {
  id: ObjectId;
  sourceId: ObjectId;
  appliesTo: (event: GameEvent, game: GameState) => boolean;
  replace: (event: GameEvent, game: GameState) => GameEvent | GameEvent[] | null;
  isSelfReplacement: boolean;
}

// --- Events ---

export const GameEventType = {
  ZONE_CHANGE: 'ZONE_CHANGE',
  ENTERS_BATTLEFIELD: 'ENTERS_BATTLEFIELD',
  LEAVES_BATTLEFIELD: 'LEAVES_BATTLEFIELD',
  PHASE_CHANGE: 'PHASE_CHANGE',
  STEP_CHANGE: 'STEP_CHANGE',
  TURN_START: 'TURN_START',
  SPELL_CAST: 'SPELL_CAST',
  ABILITY_ACTIVATED: 'ABILITY_ACTIVATED',
  ABILITY_TRIGGERED: 'ABILITY_TRIGGERED',
  SPELL_RESOLVED: 'SPELL_RESOLVED',
  SPELL_COUNTERED: 'SPELL_COUNTERED',
  TAPPED: 'TAPPED',
  UNTAPPED: 'UNTAPPED',
  DESTROYED: 'DESTROYED',
  SACRIFICED: 'SACRIFICED',
  EXILED: 'EXILED',
  ATTACKS: 'ATTACKS',
  BLOCKS: 'BLOCKS',
  COMBAT_DAMAGE_DEALT: 'COMBAT_DAMAGE_DEALT',
  DAMAGE_DEALT: 'DAMAGE_DEALT',
  LIFE_GAINED: 'LIFE_GAINED',
  LIFE_LOST: 'LIFE_LOST',
  DREW_CARD: 'DREW_CARD',
  DISCARDED: 'DISCARDED',
  PLAYER_LOST: 'PLAYER_LOST',
  PLAYER_WON: 'PLAYER_WON',
  MANA_PRODUCED: 'MANA_PRODUCED',
  COUNTER_ADDED: 'COUNTER_ADDED',
  COUNTER_REMOVED: 'COUNTER_REMOVED',
  TOKEN_CREATED: 'TOKEN_CREATED',
  SEARCHED_LIBRARY: 'SEARCHED_LIBRARY',
  SCRY: 'SCRY',
  MILLED: 'MILLED',
} as const;
export type GameEventType = (typeof GameEventType)[keyof typeof GameEventType];

export interface BaseGameEvent {
  type: GameEventType;
  timestamp: Timestamp;
  sourceId?: ObjectId;
  sourceCardId?: ObjectId;
  sourceZoneChangeCounter?: number;
  cardId?: ObjectId;
  objectZoneChangeCounter?: number;
  newObjectZoneChangeCounter?: number;
  lastKnownInfo?: LastKnownInformation;
}

export interface ZoneChangeEvent extends BaseGameEvent {
  type: typeof GameEventType.ZONE_CHANGE;
  objectId: ObjectId;
  fromZone: Zone;
  toZone: Zone;
  controller: PlayerId;
}

export interface EntersBattlefieldEvent extends BaseGameEvent {
  type: typeof GameEventType.ENTERS_BATTLEFIELD;
  objectId: ObjectId;
  controller: PlayerId;
}

export interface LeavesBattlefieldEvent extends BaseGameEvent {
  type: typeof GameEventType.LEAVES_BATTLEFIELD;
  objectId: ObjectId;
  controller: PlayerId;
  destination: Zone;
}

export interface SpellCastEvent extends BaseGameEvent {
  type: typeof GameEventType.SPELL_CAST;
  objectId: ObjectId;
  castBy: PlayerId;
  spellTypes: CardType[];
  castMethod?: string;
}

export interface DamageDealtEvent extends BaseGameEvent {
  type: typeof GameEventType.DAMAGE_DEALT;
  sourceId: ObjectId;
  targetId: ObjectId | PlayerId;
  amount: number;
  isCombatDamage: boolean;
  isCommanderDamage: boolean;
}

export interface LifeGainedEvent extends BaseGameEvent {
  type: typeof GameEventType.LIFE_GAINED;
  player: PlayerId;
  amount: number;
}

export interface LifeLostEvent extends BaseGameEvent {
  type: typeof GameEventType.LIFE_LOST;
  player: PlayerId;
  amount: number;
}

export interface DrewCardEvent extends BaseGameEvent {
  type: typeof GameEventType.DREW_CARD;
  player: PlayerId;
  objectId: ObjectId;
}

export interface DiscardedEvent extends BaseGameEvent {
  type: typeof GameEventType.DISCARDED;
  player: PlayerId;
  objectId: ObjectId;
}

export interface TappedEvent extends BaseGameEvent {
  type: typeof GameEventType.TAPPED;
  objectId: ObjectId;
}

export interface UntappedEvent extends BaseGameEvent {
  type: typeof GameEventType.UNTAPPED;
  objectId: ObjectId;
}

export interface DestroyedEvent extends BaseGameEvent {
  type: typeof GameEventType.DESTROYED;
  objectId: ObjectId;
}

export interface SacrificedEvent extends BaseGameEvent {
  type: typeof GameEventType.SACRIFICED;
  objectId: ObjectId;
  controller: PlayerId;
}

export interface StepChangeEvent extends BaseGameEvent {
  type: typeof GameEventType.STEP_CHANGE;
  phase: Phase;
  step: Step;
  activePlayer: PlayerId;
}

export interface TurnStartEvent extends BaseGameEvent {
  type: typeof GameEventType.TURN_START;
  activePlayer: PlayerId;
  turnNumber: number;
}

export interface AttacksEvent extends BaseGameEvent {
  type: typeof GameEventType.ATTACKS;
  attackerId: ObjectId;
  defendingPlayer?: PlayerId;
  defender: AttackTarget;
}

export interface BlocksEvent extends BaseGameEvent {
  type: typeof GameEventType.BLOCKS;
  blockerId: ObjectId;
  attackerId: ObjectId;
}

export interface CounterAddedEvent extends BaseGameEvent {
  type: typeof GameEventType.COUNTER_ADDED;
  objectId: ObjectId;
  counterType: string;
  amount: number;
}

export interface PlayerLostEvent extends BaseGameEvent {
  type: typeof GameEventType.PLAYER_LOST;
  player: PlayerId;
  reason: string;
}

export interface PlayerWonEvent extends BaseGameEvent {
  type: typeof GameEventType.PLAYER_WON;
  player: PlayerId;
}

export interface ManaProducedEvent extends BaseGameEvent {
  type: typeof GameEventType.MANA_PRODUCED;
  player: PlayerId;
  color: keyof ManaPool;
  amount: number;
}

export interface AbilityActivatedEvent extends BaseGameEvent {
  type: typeof GameEventType.ABILITY_ACTIVATED;
  sourceId: ObjectId;
}

export interface SpellResolvedEvent extends BaseGameEvent {
  type: typeof GameEventType.SPELL_RESOLVED;
  objectId: ObjectId;
}

export interface SpellCounteredEvent extends BaseGameEvent {
  type: typeof GameEventType.SPELL_COUNTERED;
  objectId: ObjectId;
}

export interface SearchedLibraryEvent extends BaseGameEvent {
  type: typeof GameEventType.SEARCHED_LIBRARY;
  player: PlayerId;
  foundIds: ObjectId[];
  destination: Zone;
}

export interface TokenCreatedEvent extends BaseGameEvent {
  type: typeof GameEventType.TOKEN_CREATED;
  player: PlayerId;
  objectId: ObjectId;
  tokenType?: PredefinedTokenType;
}

export interface ScryEvent extends BaseGameEvent {
  type: typeof GameEventType.SCRY;
  player: PlayerId;
  count: number;
}

export interface MilledEvent extends BaseGameEvent {
  type: typeof GameEventType.MILLED;
  player: PlayerId;
  objectIds: ObjectId[];
  count: number;
}

export type GameEvent =
  | ZoneChangeEvent
  | EntersBattlefieldEvent
  | LeavesBattlefieldEvent
  | SpellCastEvent
  | DamageDealtEvent
  | LifeGainedEvent
  | LifeLostEvent
  | DrewCardEvent
  | DiscardedEvent
  | TappedEvent
  | UntappedEvent
  | DestroyedEvent
  | SacrificedEvent
  | StepChangeEvent
  | TurnStartEvent
  | AttacksEvent
  | BlocksEvent
  | CounterAddedEvent
  | PlayerLostEvent
  | PlayerWonEvent
  | ManaProducedEvent
  | AbilityActivatedEvent
  | SpellResolvedEvent
  | SpellCounteredEvent
  | TokenCreatedEvent
  | SearchedLibraryEvent
  | ScryEvent
  | MilledEvent;

// --- Player Actions ---

export const ActionType = {
  CAST_SPELL: 'CAST_SPELL',
  ACTIVATE_ABILITY: 'ACTIVATE_ABILITY',
  PLAY_LAND: 'PLAY_LAND',
  DECLARE_ATTACKERS: 'DECLARE_ATTACKERS',
  DECLARE_BLOCKERS: 'DECLARE_BLOCKERS',
  PASS_PRIORITY: 'PASS_PRIORITY',
  CONCEDE: 'CONCEDE',
  PAY_MANA: 'PAY_MANA',
  CHOOSE_TARGETS: 'CHOOSE_TARGETS',
  MULLIGAN_KEEP: 'MULLIGAN_KEEP',
  MULLIGAN_TAKE: 'MULLIGAN_TAKE',
  COMMANDER_TO_COMMAND_ZONE: 'COMMANDER_TO_COMMAND_ZONE',
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export interface CastSpellAction {
  type: typeof ActionType.CAST_SPELL;
  playerId: PlayerId;
  cardId: ObjectId;
  targets?: (ObjectId | PlayerId)[];
  modeChoices?: number[];
  xValue?: number;
  chosenFace?: 'front' | 'back';
  chosenHalf?: 'left' | 'right' | 'fused';
  castMethod?: string;
  castAsAdventure?: boolean;
}

export interface ActivateAbilityAction {
  type: typeof ActionType.ACTIVATE_ABILITY;
  playerId: PlayerId;
  sourceId: ObjectId;
  abilityIndex: number;
  targets?: (ObjectId | PlayerId)[];
}

export interface PlayLandAction {
  type: typeof ActionType.PLAY_LAND;
  playerId: PlayerId;
  cardId: ObjectId;
  chosenFace?: 'front' | 'back';
}

export interface DeclareAttackersAction {
  type: typeof ActionType.DECLARE_ATTACKERS;
  playerId: PlayerId;
  attackers: Array<{
    attackerId: ObjectId;
    defendingPlayer?: PlayerId;
    defender?: AttackTarget;
  }>;
}

export interface DeclareBlockersAction {
  type: typeof ActionType.DECLARE_BLOCKERS;
  playerId: PlayerId;
  blockers: Array<{ blockerId: ObjectId; attackerId: ObjectId }>;
}

export interface PassPriorityAction {
  type: typeof ActionType.PASS_PRIORITY;
  playerId: PlayerId;
}

export interface MulliganKeepAction {
  type: typeof ActionType.MULLIGAN_KEEP;
  playerId: PlayerId;
}

export interface MulliganTakeAction {
  type: typeof ActionType.MULLIGAN_TAKE;
  playerId: PlayerId;
}

export interface ConcedeAction {
  type: typeof ActionType.CONCEDE;
  playerId: PlayerId;
}

export interface CommanderToCommandZoneAction {
  type: typeof ActionType.COMMANDER_TO_COMMAND_ZONE;
  playerId: PlayerId;
  cardId: ObjectId;
}

export type PlayerAction =
  | CastSpellAction
  | ActivateAbilityAction
  | PlayLandAction
  | DeclareAttackersAction
  | DeclareBlockersAction
  | PassPriorityAction
  | MulliganKeepAction
  | MulliganTakeAction
  | ConcedeAction
  | CommanderToCommandZoneAction;

// --- Stack ---

export const StackEntryType = {
  SPELL: 'SPELL',
  ACTIVATED_ABILITY: 'ACTIVATED_ABILITY',
  TRIGGERED_ABILITY: 'TRIGGERED_ABILITY',
} as const;
export type StackEntryType = (typeof StackEntryType)[keyof typeof StackEntryType];

export interface StackEntry {
  id: ObjectId;
  entryType: StackEntryType;
  sourceId: ObjectId;
  sourceCardId?: ObjectId;
  sourceZoneChangeCounter: number;
  sourceSnapshot?: LastKnownInformation;
  controller: PlayerId;
  timestamp: Timestamp;
  targets: (ObjectId | PlayerId)[];
  targetZoneChangeCounters?: Array<number | null>;
  targetSpecs?: TargetSpec[];
  cardInstance?: CardInstance;
  ability?: AbilityDefinition;
  xValue?: number;
  spellDefinition?: CardDefinition;
  modeChoices?: number[];
  castMethod?: string;
  additionalCostsPaid?: string[];
  castAsAdventure?: boolean;
  chosenFace?: 'front' | 'back';
  chosenHalf?: 'left' | 'right' | 'fused';
  resolve: (ctx: EffectContext) => void | Promise<void>;
}

// --- Combat ---

export interface AttackTarget {
  type: 'player' | 'planeswalker';
  id: ObjectId | PlayerId;
}

export interface CombatState {
  attackingPlayer: PlayerId;
  attackers: Map<ObjectId, AttackTarget>;
  blockers: Map<ObjectId, ObjectId>; // blockerId -> attackerId
  blockerOrder: Map<ObjectId, ObjectId[]>; // attackerId -> ordered blocker ids
  damageAssignments: DamageAssignment[];
  firstStrikeDamageDealt: boolean;
}

export interface DamageAssignment {
  sourceId: ObjectId;
  targetId: ObjectId | PlayerId;
  amount: number;
}

// --- Player State ---

export interface PlayerState {
  id: PlayerId;
  name: string;
  life: number;
  manaPool: ManaPool;
  commanderDamageReceived: Record<ObjectId, number>;
  commanderTimesCast: Record<ObjectId, number>;
  hasPlayedLand: boolean;
  landsPlayedThisTurn: number;
  landPlaysAvailable: number;
  hasLost: boolean;
  hasConceded: boolean;
  poisonCounters: number;
  commanderIds: ObjectId[];
  colorIdentity: ManaColor[];
  drewFromEmptyLibrary: boolean;
  spellsCastThisTurn?: number;
  experienceCounters?: number;
  energyCounters?: number;
}

export interface DelayedTrigger {
  id: ObjectId;
  ability: TriggeredAbilityDef;
  source: CardInstance;
  controller: PlayerId;
  expiresAfterTrigger: boolean;
}

export interface CastPermission {
  objectId: ObjectId;
  zoneChangeCounter: number;
  zone: Zone;
  castBy: PlayerId;
  owner: PlayerId;
  alternativeCost: Cost;
  reason: string;
  timing: 'normal';
  castOnly: true;
}

// --- Game State ---

export interface GameState {
  turnNumber: number;
  activePlayer: PlayerId;
  currentPhase: Phase;
  currentStep: Step;
  players: Record<PlayerId, PlayerState>;
  turnOrder: PlayerId[];
  zones: Record<PlayerId, Record<Zone, CardInstance[]>>;
  stack: StackEntry[];
  combat: CombatState | null;
  continuousEffects: ContinuousEffect[];
  replacementEffects: ReplacementEffect[];
  lastKnownInformation: Record<string, LastKnownInformation>;
  timestampCounter: number;
  objectIdCounter: number;
  eventLog: GameEvent[];
  priorityPlayer: PlayerId | null;
  passedPriority: Set<PlayerId>;
  pendingTriggers: PendingTrigger[];
  delayedTriggers: DelayedTrigger[];
  castPermissions: CastPermission[];
  waitingForChoice: boolean;
  isGameOver: boolean;
  winner: PlayerId | null;
  loyaltyAbilitiesUsedThisTurn?: string[];
  dayNight?: 'day' | 'night';
  monarch?: PlayerId;
  initiativeHolder?: PlayerId;
  spellsCastLastTurn?: Record<PlayerId, number>;
  lastCompletedTurnPlayer?: PlayerId;
  pendingFreeCasts?: Array<{ objectId: ObjectId; playerId: PlayerId; reason: 'suspend' }>;
  pendingExtraTurns?: PlayerId[];
  mulliganState?: {
    activePlayer: PlayerId;
    taken: Partial<Record<PlayerId, number>>;
    kept: Partial<Record<PlayerId, boolean>>;
  };
}

export interface PendingTrigger {
  ability: TriggeredAbilityDef;
  source: CardInstance;
  event: GameEvent;
  controller: PlayerId;
  delayedTriggerId?: ObjectId;
}

// --- Forward reference: GameEngine interface (for EffectContext) ---

export interface GameEngine {
  getState(): GameState;
  drawCards(player: PlayerId, count: number): void;
  addMana(player: PlayerId, color: keyof ManaPool, amount: number): void;
  payMana(player: PlayerId, cost: ManaCost): boolean;
  canPayMana(player: PlayerId, cost: ManaCost): boolean;
  gainLife(player: PlayerId, amount: number): void;
  loseLife(player: PlayerId, amount: number): void;
  dealDamage(sourceId: ObjectId, targetId: ObjectId | PlayerId, amount: number, isCombat: boolean): void;
  destroyPermanent(objectId: ObjectId): void;
  sacrificePermanent(objectId: ObjectId, controller: PlayerId): void;
  exilePermanent(objectId: ObjectId): void;
  moveCard(objectId: ObjectId, toZone: Zone, toOwner?: PlayerId): void;
  createToken(controller: PlayerId, definition: Partial<CardDefinition>): CardInstance;
  createPredefinedToken(controller: PlayerId, tokenType: PredefinedTokenType): CardInstance;
  addCounters(objectId: ObjectId, counterType: string, amount: number): void;
  removeCounters(objectId: ObjectId, counterType: string, amount: number): void;
  tapPermanent(objectId: ObjectId): void;
  untapPermanent(objectId: ObjectId): void;
  counterSpell(stackEntryId: ObjectId): void;
  findCards(zone: Zone, filter?: CardFilter, controller?: PlayerId): CardInstance[];
  getCard(objectId: ObjectId): CardInstance | undefined;
  getBattlefield(filter?: CardFilter, controller?: PlayerId): CardInstance[];
  getHand(player: PlayerId): CardInstance[];
  getGraveyard(player: PlayerId): CardInstance[];
  getLibrary(player: PlayerId): CardInstance[];
  shuffleLibrary(player: PlayerId): void;
  emitEvent(event: GameEvent): void;
  getOpponents(player: PlayerId): PlayerId[];
  getActivePlayers(): PlayerId[];
  searchLibrary(player: PlayerId, filter: CardFilter, destination: Zone, count: number): Promise<CardInstance[]>;
  searchLibraryWithOptions(options: SearchLibraryOptions): Promise<CardInstance[]>;
  scry(player: PlayerId, count: number): Promise<void>;
  mill(player: PlayerId, count: number): void;
  fight(creatureAId: ObjectId, creatureBId: ObjectId): void;
  returnToHand(objectId: ObjectId): void;
  attachPermanent(attachmentId: ObjectId, hostId: ObjectId): void;
  detachPermanent(attachmentId: ObjectId): void;
  proliferate(player: PlayerId): Promise<void>;
  copyPermanent(objectId: ObjectId, controller: PlayerId): CardInstance | undefined;
  copySpellOnStack(stackEntryId: ObjectId, newController: PlayerId): void;
  changeControl(objectId: ObjectId, newController: PlayerId, duration?: EffectDuration): void;
  castWithoutPayingManaCost(cardId: ObjectId, controller: PlayerId): Promise<void>;
  createEmblem(controller: PlayerId, abilities: AbilityDefinition[], description: string): CardInstance;
  transformPermanent(objectId: ObjectId): void;
  becomeMonarch(player: PlayerId): void;
  becomeInitiativeHolder(player: PlayerId): void;
  registerDelayedTrigger(trigger: DelayedTrigger): void;
  airbendObject(objectId: ObjectId, cost: Cost, actingPlayer: PlayerId): void;
  earthbendLand(targetId: ObjectId, counterCount: number, returnController: PlayerId): void;
  unlessPlayerPays(player: PlayerId, sourceId: ObjectId, cost: Cost, prompt: string): Promise<boolean>;
  sacrificePermanents(player: PlayerId, filter: CardFilter, count: number, prompt?: string): Promise<CardInstance[]>;
  addPlayerCounters(player: PlayerId, counterType: 'experience' | 'energy', amount: number): void;
  removePlayerCounters(player: PlayerId, counterType: 'experience' | 'energy', amount: number): boolean;
  grantExtraTurn(player: PlayerId): void;
  endTurn(): void;
}
