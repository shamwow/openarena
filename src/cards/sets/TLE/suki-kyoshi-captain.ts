import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { createDoubleStrikeAbilities } from '../../../engine/AbilityPrimitives';

export const SukiKyoshiCaptain = CardBuilder.create('Suki, Kyoshi Captain')
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 3)
  .staticAbility(
    {
      type: 'pump',
      power: 1,
      toughness: 1,
      filter: {
        types: [CardType.CREATURE],
        subtypes: ['Warrior'],
        controller: 'you',
        custom: (card, _state) => card.objectId !== undefined,
      },
    },
    { description: 'Other Warriors you control get +1/+1.' },
  )
  .activated(
    { mana: parseManaCost('{3}{W}') },
    async (ctx) => {
      const warriors = ctx.game.getBattlefield({ types: [CardType.CREATURE], subtypes: ['Warrior'], controller: 'you', tapped: true }, ctx.controller);
      for (const warrior of warriors) {
        ctx.game.grantAbilitiesUntilEndOfTurn(
          ctx.source.objectId,
          warrior.objectId,
          warrior.zoneChangeCounter,
          createDoubleStrikeAbilities(),
        );
      }
    },
    { description: '{3}{W}: Attacking Warriors you control gain double strike until end of turn.' },
  )
  .build();
