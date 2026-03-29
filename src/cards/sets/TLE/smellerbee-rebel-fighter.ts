import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createHasteAbilities } from '../../../engine/AbilityPrimitives';

export const SmellerbeeRebelFighter = CardBuilder.create('Smellerbee, Rebel Fighter')
  .cost('{3}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(3, 3)
  .firstStrike()
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: createHasteAbilities(),
      filter: {
        types: [CardType.CREATURE],
        controller: 'you',
        custom: (card, _state) => card.objectId !== undefined,
      },
    },
    { description: 'Other creatures you control have haste.' },
  )
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const doDiscard = await ctx.choices.chooseYesNo('Discard your hand?');
      if (!doDiscard) return;
      const hand = ctx.game.getHand(ctx.controller);
      for (const card of hand) {
        ctx.game.discardCard(ctx.controller, card.objectId);
      }
      // Draw cards equal to number of attacking creatures
      // TODO: Count attacking creatures properly
      const attackingCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you', tapped: true }, ctx.controller);
      ctx.game.drawCards(ctx.controller, Math.max(1, attackingCreatures.length));
    },
    { optional: true, description: 'Whenever Smellerbee attacks, you may discard your hand. If you do, draw cards equal to the number of attacking creatures.' },
  )
  .build();
