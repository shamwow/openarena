import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const LongshotRebelBowman = CardBuilder.create('Longshot, Rebel Bowman')
  .cost('{3}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(3, 3)
  .reach()
  .staticAbility(
    {
      type: 'cost-reduction',
      amount: 1,
      filter: { custom: (card) => !card.definition.types.includes(CardType.CREATURE) },
      appliesTo: 'you',
    },
    { description: 'Noncreature spells you cast cost {1} less to cast.' },
  )
  .triggered(
    { on: 'cast-spell', filter: { controller: 'you', custom: (card) => !card.spellTypes?.includes(CardType.CREATURE) } },
    (ctx) => {
      for (const opponent of ctx.game.getOpponents(ctx.controller)) {
        ctx.game.dealDamage(ctx.source.objectId, opponent, 2, false);
      }
    },
    { description: 'Whenever you cast a noncreature spell, Longshot deals 2 damage to each opponent.' },
  )
  .build();
