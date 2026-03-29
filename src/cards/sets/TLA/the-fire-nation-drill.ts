import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const TheFireNationDrill = CardBuilder.create('The Fire Nation Drill')
  .cost('{2}{B}{B}')
  .types(CardType.ARTIFACT)
  .subtypes('Vehicle')
  .supertypes('Legendary')
  .stats(6, 3)
  .trample()
  .etbEffect(async (ctx) => {
    // "you may tap it. When you do, destroy target creature with power 4 or less."
    const tapIt = await ctx.choices.chooseYesNo('Tap The Fire Nation Drill to destroy a creature with power 4 or less?');
    if (tapIt) {
      ctx.game.tapPermanent(ctx.source.objectId);
      const targets = ctx.game.getBattlefield({ types: [CardType.CREATURE as any], power: { op: 'lte', value: 4 } })
        .filter(c => c.objectId !== ctx.source.objectId);
      if (targets.length > 0) {
        const target = await ctx.choices.chooseOne('Destroy target creature with power 4 or less', targets, c => c.definition.name);
        ctx.game.destroyPermanent(target.objectId);
      }
    }
  }, { description: 'When The Fire Nation Drill enters, you may tap it. When you do, destroy target creature with power 4 or less.' })
  .activated(
    { mana: parseManaCost('{1}') },
    (ctx) => {
      // TODO: "Permanents your opponents control lose hexproof and indestructible until end of turn."
    },
    { description: '{1}: Permanents your opponents control lose hexproof and indestructible until end of turn.' },
  )
  .crew(2)
  .build();
