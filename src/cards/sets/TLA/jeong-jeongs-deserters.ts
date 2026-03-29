import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const JeongJeongsDeserters = CardBuilder.create("Jeong Jeong's Deserters")
  .cost('{1}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(1, 2)
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Put a +1/+1 counter on target creature', creatures, c => c.definition.name);
    ctx.game.addCounters(target.objectId, '+1/+1', 1);
  }, { description: 'When this creature enters, put a +1/+1 counter on target creature.' })
  .build();
