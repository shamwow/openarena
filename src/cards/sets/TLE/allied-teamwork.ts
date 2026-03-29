import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const AlliedTeamwork = CardBuilder.create('Allied Teamwork')
  .cost('{2}{W}')
  .types(CardType.ENCHANTMENT)
  .etbEffect(async (ctx) => {
    ctx.game.createToken(ctx.controller, {
      name: 'Ally',
      types: [CardType.CREATURE],
      subtypes: ['Ally'],
      power: 1,
      toughness: 1,
      colorIdentity: [ManaColor.WHITE],
    });
  }, { description: 'When this enchantment enters, create a 1/1 white Ally creature token.' })
  .staticAbility(
    {
      type: 'pump',
      power: 1,
      toughness: 1,
      filter: { controller: 'you', subtypes: ['Ally'] },
    },
    { description: 'Allies you control get +1/+1.' }
  )
  .build();
