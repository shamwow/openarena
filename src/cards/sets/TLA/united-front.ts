import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const UnitedFront = CardBuilder.create('United Front')
  .cost('{X}{W}{W}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const x = ctx.xValue ?? 0;
    for (let i = 0; i < x; i++) {
      ctx.game.createToken(ctx.controller, {
        name: 'Ally',
        types: [CardType.CREATURE],
        subtypes: ['Ally'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
    }
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    for (const creature of creatures) {
      ctx.game.addCounters(creature.objectId, '+1/+1', 1);
    }
  }, { description: 'Create X 1/1 white Ally creature tokens, then put a +1/+1 counter on each creature you control.' })
  .build();
