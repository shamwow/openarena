import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const SukiKyoshiWarrior = CardBuilder.create('Suki, Kyoshi Warrior')
  .cost('{2}{G/W}{G/W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(0, 4)
  .staticAbility(
    {
      type: 'set-base-pt',
      power: (game, source) => {
        return game.zones[source.controller].BATTLEFIELD.filter(
          c => c.definition.types.includes(CardType.CREATURE),
        ).length;
      },
      toughness: 4,
      filter: { self: true },
      layer: 'cda',
    },
    { description: 'Suki\'s power is equal to the number of creatures you control.' },
  )
  .triggered(
    { on: 'attacks', filter: { self: true } },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Ally',
        types: [CardType.CREATURE],
        subtypes: ['Ally'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
      // TODO: Token enters tapped and attacking
    },
    { description: 'Whenever Suki attacks, create a 1/1 white Ally creature token that\'s tapped and attacking.' },
  )
  .build();
