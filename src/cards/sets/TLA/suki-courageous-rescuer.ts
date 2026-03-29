import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const SukiCourageousRescuer = CardBuilder.create('Suki, Courageous Rescuer')
  .cost('{1}{W}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(2, 4)
  .staticAbility(
    {
      type: 'pump',
      power: 1,
      toughness: 0,
      filter: {
        types: [CardType.CREATURE],
        controller: 'you',
        custom: (card, _state) => card.objectId !== undefined,
      },
    },
    { description: 'Other creatures you control get +1/+0.' },
  )
  .triggered(
    { on: 'leaves-battlefield', filter: { controller: 'you' } },
    async (ctx) => {
      // TODO: Only during your turn
      ctx.game.createToken(ctx.controller, {
        name: 'Ally',
        types: [CardType.CREATURE],
        subtypes: ['Ally'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
    },
    {
      oncePerTurn: true,
      description: 'Whenever another permanent you control leaves the battlefield during your turn, create a 1/1 white Ally creature token. This ability triggers only once each turn.',
    },
  )
  .build();
