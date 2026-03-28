import { CardBuilder } from '../../CardBuilder';
import { hasType } from '../../../engine/GameState';
import { CardType, parseManaCost } from '../../../engine/types';
import {
  createTrampleAbilities,
} from '../../../engine/AbilityPrimitives';

export const RhysticStudy = CardBuilder.create('Rhystic Study')
  .cost('{2}{U}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'cast-spell', filter: { controller: 'opponent' } },
    async (ctx) => {
      // In full implementation, opponent would choose to pay {1}
      // For now, just draw a card (simplified)
      const draw = await ctx.choices.chooseYesNo('Rhystic Study: Draw a card?');
      if (draw) {
        ctx.game.drawCards(ctx.controller, 1);
      }
    },
    { optional: true, description: 'Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.' }
  )
  .oracleText('Whenever an opponent casts a spell, you may draw a card unless that player pays {1}.')
  .build();

export const SmotheringTithe = CardBuilder.create('Smothering Tithe')
  .cost('{3}{W}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'draw-card', whose: 'opponents' },
    async (ctx) => {
      // Create a Treasure token
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
                (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c])
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
  .oracleText('Whenever an opponent draws a card, that player may pay {2}. If the player doesn\'t, you create a Treasure token.')
  .build();

export const Propaganda = CardBuilder.create('Propaganda')
  .cost('{2}{U}')
  .types(CardType.ENCHANTMENT)
  .staticAbility(
    { type: 'attack-tax', filter: { controller: 'opponent' }, cost: { mana: parseManaCost('{2}') }, defender: 'source-controller' },
    { description: 'Creatures can\'t attack you unless their controller pays {2} for each creature they control that\'s attacking you.' }
  )
  .oracleText('Creatures can\'t attack you unless their controller pays {2} for each creature they control that\'s attacking you.')
  .build();

export const GhostlyPrison = CardBuilder.create('Ghostly Prison')
  .cost('{2}{W}')
  .types(CardType.ENCHANTMENT)
  .staticAbility(
    { type: 'attack-tax', filter: { controller: 'opponent' }, cost: { mana: parseManaCost('{2}') }, defender: 'source-controller' },
    { description: 'Creatures can\'t attack you unless their controller pays {2} for each creature they control that\'s attacking you.' }
  )
  .oracleText('Creatures can\'t attack you unless their controller pays {2} for each creature they control that\'s attacking you.')
  .build();

export const SylvanLibrary = CardBuilder.create('Sylvan Library')
  .cost('{1}{G}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'upkeep', whose: 'yours' },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 2);
      // Player must put two cards back or pay 4 life each
      const hand = ctx.game.getHand(ctx.controller);
      if (hand.length >= 2) {
        const payLife = await ctx.choices.chooseYesNo('Pay 4 life to keep the extra cards?');
        if (!payLife) {
          const toReturn = await ctx.choices.chooseN('Put two cards on top of your library', hand, 2, c => c.definition.name);
          for (const card of toReturn) {
            ctx.game.moveCard(card.objectId, 'LIBRARY', ctx.controller);
          }
        } else {
          ctx.game.loseLife(ctx.controller, 4);
        }
      }
    },
    { description: 'At the beginning of your upkeep, draw two additional cards, then put two back or pay 4 life each.' }
  )
  .oracleText('At the beginning of your draw step, you may draw two additional cards. If you do, choose two cards in your hand drawn this turn. For each of those cards, pay 4 life or put the card on top of your library.')
  .build();

export const CrystallineArmor = CardBuilder.create('Crystalline Armor')
  .cost('{3}{G}')
  .types(CardType.ENCHANTMENT)
  .enchant({ what: 'creature', count: 1 })
  .staticAbility(
    {
      type: 'attached-pump',
      power: (game, source) => game.zones[source.controller].BATTLEFIELD.filter(card => !card.phasedOut && hasType(card, CardType.LAND)).length,
      toughness: (game, source) => game.zones[source.controller].BATTLEFIELD.filter(card => !card.phasedOut && hasType(card, CardType.LAND)).length,
    },
    { description: 'Enchanted creature gets +1/+1 for each land you control.' },
  )
  .grantToAttached({ type: 'grant-abilities', abilities: createTrampleAbilities(), filter: { self: true } })
  .oracleText('Enchant creature\nEnchanted creature gets +1/+1 for each land you control and has trample.')
  .build();

export const EarthbenderAscension = CardBuilder.create('Earthbender Ascension')
  .cost('{2}{G}')
  .types(CardType.ENCHANTMENT)
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' });
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne(
        'Choose a land you control',
        lands,
        (card) => card.definition.name,
      );

      if (target && typeof target !== 'string') {
        ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
      }
    }

    const selected = await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: { types: [CardType.LAND], supertypes: ['Basic'] },
      destination: 'BATTLEFIELD',
      count: 1,
      optional: true,
      shuffle: true,
    });

    for (const card of selected) {
      const instance = ctx.game.getCard(card.objectId);
      if (instance) {
        instance.tapped = true;
      }
    }
  }, { description: 'When Earthbender Ascension enters, earthbend 2. Then search for a basic land tapped.' })
  .landfall(async (ctx) => {
    ctx.game.addCounters(ctx.source.objectId, 'quest', 1, {
      player: ctx.controller,
      sourceId: ctx.source.objectId,
      sourceCardId: ctx.source.cardId,
      sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
    });

    const questCounters = ctx.game.getCard(ctx.source.objectId)?.counters.quest ?? 0;
    if (questCounters < 4) return;

    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' });
    if (creatures.length === 0) return;

    const target = await ctx.choices.chooseOne(
      'Choose a creature you control',
      creatures,
      (card) => card.definition.name,
    );

    if (!target || typeof target === 'string') return;

    ctx.game.addCounters(target.objectId, '+1/+1', 1, {
      player: ctx.controller,
      sourceId: ctx.source.objectId,
      sourceCardId: ctx.source.cardId,
      sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
    });
    ctx.game.grantAbilitiesUntilEndOfTurn(
      ctx.source.objectId,
      target.objectId,
      target.zoneChangeCounter,
      createTrampleAbilities(),
    );
  }, { description: 'Whenever a land enters under your control, add a quest counter. At four or more, grow a creature and grant trample.' })
  .oracleText('When Earthbender Ascension enters, earthbend 2. Then search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\nLandfall — Whenever a land you control enters, put a quest counter on Earthbender Ascension. When you do, if it has four or more quest counters on it, put a +1/+1 counter on target creature you control. It gains trample until end of turn.')
  .build();
