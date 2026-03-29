import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const MongooseLizard = CardBuilder.create('Mongoose Lizard')
  .cost('{4}{R}{R}')
  .types(CardType.CREATURE)
  .subtypes('Mongoose', 'Lizard')
  .stats(5, 6)
  .menace()
  .etbEffect(async (ctx) => {
    const targets = [
      ...ctx.game.getBattlefield({ types: [CardType.CREATURE as any] }),
      ...ctx.game.getActivePlayers(),
    ];
    if (targets.length > 0) {
      const target = await ctx.choices.chooseOne('Deal 1 damage to any target', targets as any[], (t: any) =>
        typeof t === 'string' ? ctx.state.players[t]?.name ?? t : t.definition.name,
      );
      if (typeof target === 'string') {
        ctx.game.dealDamage(ctx.source.objectId, target, 1, false);
      } else {
        ctx.game.dealDamage(ctx.source.objectId, (target as any).objectId, 1, false);
      }
    }
  }, { description: 'When this creature enters, it deals 1 damage to any target.' })
  .landcycling('{2}', 'Mountain')
  .build();
