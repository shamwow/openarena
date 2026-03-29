import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';
import { createMenaceAbilities, createProwessAbilities } from '../../../engine/AbilityPrimitives';

export const SokkaTenaciousTactician = CardBuilder.create('Sokka, Tenacious Tactician')
  .cost('{1}{U}{R}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Warrior', 'Ally')
  .supertypes('Legendary')
  .stats(3, 3)
  .menace()
  .prowess()
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: [...createMenaceAbilities(), ...createProwessAbilities()],
      filter: { subtypes: ['Ally'], controller: 'you' },
    },
    { description: 'Other Allies you control have menace and prowess.' },
  )
  .triggered(
    {
      on: 'cast-spell',
      filter: {
        controller: 'you',
        custom: (card) => !card.definition.types.includes(CardType.CREATURE as any),
      },
    },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Ally',
        types: [CardType.CREATURE as any],
        subtypes: ['Ally'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
    },
    { description: 'Whenever you cast a noncreature spell, create a 1/1 white Ally creature token.' },
  )
  .build();
