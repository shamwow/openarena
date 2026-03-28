import assert from 'node:assert/strict';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { prebuiltDecks } from '../../../src/cards/decks.ts';
import { createTestGameStateBuilder, type DeckConfig } from '../../../src/testing/testGameStateBuilder.ts';
import { GameEngineImpl, type ChoiceRequest } from '../../../src/engine/GameEngine.ts';
import { Zone, CardType, type CardInstance, type CardDefinition, type GameState, type PlayerId, type PlayerAction } from '../../../src/engine/types.ts';

export interface HarnessOptions {
  decks?: DeckConfig[];
  choiceResponder?: (request: ChoiceRequest) => void;
  setup?: (builder: ReturnType<typeof createTestGameStateBuilder>) => void;
}

export function createHarness(options: HarnessOptions = {}) {
  const builder = createTestGameStateBuilder(options.decks ?? prebuiltDecks);
  options.setup?.(builder);

  const state = builder.build();
  const engine = new GameEngineImpl({
    initialState: state,
    drawOpeningHands: false,
    runGameLoopOnInit: false,
  });

  engine.onChoiceRequest(options.choiceResponder ?? createDefaultChoiceResponder());
  return { builder, state, engine };
}

export function createDefaultChoiceResponder(): (request: ChoiceRequest) => void {
  return (request) => {
    if (request.type === 'chooseYesNo') {
      request.resolve(true);
      return;
    }

    if (request.type === 'chooseOne' || request.type === 'choosePlayer') {
      request.resolve(request.options[0]);
      return;
    }

    if (request.type === 'chooseN' || request.type === 'chooseUpToN') {
      request.resolve(request.options.slice(0, request.count ?? 0));
      return;
    }

    if (request.type === 'orderObjects') {
      request.resolve(request.options);
      return;
    }

    request.resolve(request.options);
  };
}

export async function settleEngine(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}

export async function waitForCondition(
  condition: () => boolean,
  description: string,
  timeoutMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${description}.`);
    }
    await new Promise<void>(resolve => setImmediate(resolve));
  }
}

export function getLegalAction(
  engine: GameEngineImpl,
  playerId: PlayerId,
  matcher: (action: PlayerAction) => boolean,
): PlayerAction {
  const action = engine.getLegalActions(playerId).find(matcher);
  assert.ok(action, `Could not find a matching action for ${playerId}.`);
  return action;
}

export function zoneNames(state: GameState, playerId: PlayerId, zone: Zone): string[] {
  return state.zones[playerId][zone].map(card => card.definition.name);
}

export function battlefieldNames(state: GameState, playerId: PlayerId): string[] {
  return zoneNames(state, playerId, Zone.BATTLEFIELD);
}

export function graveyardNames(state: GameState, playerId: PlayerId): string[] {
  return zoneNames(state, playerId, Zone.GRAVEYARD);
}

export function handNames(state: GameState, playerId: PlayerId): string[] {
  return zoneNames(state, playerId, Zone.HAND);
}

export function commandNames(state: GameState, playerId: PlayerId): string[] {
  return zoneNames(state, playerId, Zone.COMMAND);
}

export function stackNames(state: GameState): string[] {
  return state.stack.map(entry => entry.cardInstance?.definition.name ?? entry.ability?.description ?? entry.entryType);
}

export function getCard(state: GameState, playerId: PlayerId, zone: Zone, name: string): CardInstance {
  const card = state.zones[playerId][zone].find(entry => entry.definition.name === name);
  assert.ok(card, `Expected ${name} in ${playerId}.${zone}.`);
  return card;
}

export function makeCommander(name: string, manaCost = '{3}'): CardDefinition {
  return CardBuilder.create(name)
    .cost(manaCost)
    .types(CardType.CREATURE)
    .supertypes('Legendary')
    .stats(3, 3)
    .build();
}

export function makeTargetedCreatureRemoval(name: string, cost: string) {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.INSTANT)
    .spellEffect(async (ctx) => {
      const target = ctx.targets[0];
      if (target && typeof target !== 'string') {
        ctx.game.destroyPermanent(target.objectId);
      }
    }, {
      targets: [{
        what: 'creature',
        controller: 'opponent',
        count: 1,
      }],
    })
    .build();
}

export function makeWardedCreature(name = 'Warded Creature') {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .ward('{2}')
    .build();
}

export function makeSmotheringTithe() {
  return CardBuilder.create('Smothering Tithe')
    .cost('{3}{W}')
    .types(CardType.ENCHANTMENT)
    .triggered(
      { on: 'draw-card', whose: 'opponents' },
      async (ctx) => {
        const create = await ctx.choices.chooseYesNo('Smothering Tithe: Create a Treasure token?');
        if (create) {
          ctx.game.createToken(ctx.controller, {
            name: 'Treasure',
            types: [CardType.ARTIFACT],
            subtypes: ['Treasure'],
            abilities: [{
              kind: 'activated' as const,
              cost: { tap: true, sacrifice: { self: true } },
              effect: async (innerCtx) => {
                const color = await innerCtx.choices.chooseOne(
                  'Add one mana of any color',
                  ['W', 'U', 'B', 'R', 'G'] as const,
                  c => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c])
                );
                innerCtx.game.addMana(innerCtx.controller, color, 1);
              },
              timing: 'instant' as const,
              isManaAbility: true,
              description: '{T}, Sacrifice: Add one mana of any color.',
            }],
          });
        }
      },
      { optional: true, description: 'Whenever an opponent draws, you may create a Treasure unless they pay {2}.' }
    )
    .build();
}
