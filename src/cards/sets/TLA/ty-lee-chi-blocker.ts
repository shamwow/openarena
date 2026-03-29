import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TyLeeChiBlocker = CardBuilder.create('Ty Lee, Chi Blocker')
  .cost('{2}{U}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Performer', 'Ally')
  .supertypes('Legendary')
  .stats(2, 1)
  .flash()
  .prowess()
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE as any] })
      .filter(c => c.objectId !== ctx.source.objectId);
    if (creatures.length > 0) {
      const targets = await ctx.choices.chooseUpToN('Tap up to one target creature', creatures, 1, c => c.definition.name);
      for (const target of targets) {
        ctx.game.tapPermanent(target.objectId);
        // TODO: "doesn't untap during its controller's untap step for as long as you control Ty Lee" not fully supported
      }
    }
  }, { description: 'When Ty Lee enters, tap up to one target creature. It doesn\'t untap during its controller\'s untap step for as long as you control Ty Lee.' })
  .build();
