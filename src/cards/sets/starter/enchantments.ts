import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

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
          keywords: [],
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
    { type: 'cant-attack', filter: { controller: 'opponent' } },
    { description: 'Creatures can\'t attack you unless their controller pays {2} for each creature they control that\'s attacking you.' }
  )
  .oracleText('Creatures can\'t attack you unless their controller pays {2} for each creature they control that\'s attacking you.')
  .build();

export const GhostlyPrison = CardBuilder.create('Ghostly Prison')
  .cost('{2}{W}')
  .types(CardType.ENCHANTMENT)
  .staticAbility(
    { type: 'cant-attack', filter: { controller: 'opponent' } },
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
