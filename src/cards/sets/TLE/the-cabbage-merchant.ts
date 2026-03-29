import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const TheCabbageMerchant = CardBuilder.create('The Cabbage Merchant')
  .cost('{2}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Citizen')
  .stats(2, 2)
  .triggered(
    {
      on: 'custom',
      match: (event, source) =>
        event.type === GameEventType.SPELL_CAST
        && event.castBy !== source.controller
        && !event.spellTypes.includes(CardType.CREATURE),
    },
    async (ctx) => {
      ctx.game.createPredefinedToken(ctx.controller, 'Food');
    },
    { description: 'Whenever an opponent casts a noncreature spell, create a Food token.' },
  )
  .triggered(
    { on: 'deals-combat-damage-to-player', filter: { controller: 'opponent' } },
    async (ctx) => {
      // Sacrifice a Food token
      const foods = ctx.game.getBattlefield({ subtypes: ['Food'], controller: 'you' }, ctx.controller);
      if (foods.length > 0) {
        ctx.game.sacrificePermanent(foods[0].objectId, ctx.controller);
      }
    },
    { description: 'Whenever a creature deals combat damage to you, sacrifice a Food token.' },
  )
  .activated(
    { custom: (_game, _source) => true },
    async (ctx) => {
      // Tap two untapped Foods you control
      const foods = ctx.game.getBattlefield({ subtypes: ['Food'], controller: 'you', tapped: false }, ctx.controller);
      if (foods.length < 2) return;
      ctx.game.tapPermanent(foods[0].objectId);
      ctx.game.tapPermanent(foods[1].objectId);
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['W', 'U', 'B', 'R', 'G'] as const,
        (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }],
      description: 'Tap two untapped Foods you control: Add one mana of any color.',
    },
  )
  .build();
