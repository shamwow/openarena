import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const KataraHeroicHealer = CardBuilder.create('Katara, Heroic Healer')
  .cost('{4}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(2, 3)
  .lifelink()
  .etbEffect((ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
      .filter(c => c.objectId !== ctx.source.objectId);
    for (const creature of creatures) {
      ctx.game.addCounters(creature.objectId, '+1/+1', 1);
    }
  }, { description: 'When Katara enters, put a +1/+1 counter on each other creature you control.' })
  .build();
