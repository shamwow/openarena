import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const MomoRambunctiousRascal = CardBuilder.create('Momo, Rambunctious Rascal')
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Lemur', 'Bat', 'Ally')
  .stats(1, 1)
  .flying()
  .etbEffect(async (ctx) => {
    const tappedOpponentCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], tapped: true })
      .filter(c => c.controller !== ctx.controller);
    if (tappedOpponentCreatures.length > 0) {
      const target = await ctx.choices.chooseOne('Deal 4 damage to target tapped creature an opponent controls', tappedOpponentCreatures, c => c.definition.name);
      ctx.game.dealDamage(ctx.source.objectId, target.objectId, 4, false);
    }
  }, { description: 'When Momo enters, he deals 4 damage to target tapped creature an opponent controls.' })
  .build();
