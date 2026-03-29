import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AnimalAttendant = CardBuilder.create('Animal Attendant')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Citizen')
  .stats(2, 2)
  .activated(
    { tap: true },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['W', 'U', 'B', 'R', 'G'] as const,
        (candidate) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[candidate]),
      );
      ctx.game.addMana(ctx.controller, color, 1, {
        trackedMana: {
          sourceId: ctx.source.objectId,
          effect: {
            kind: 'etb-counter-on-non-human-creature',
            counterType: '+1/+1',
            amount: 1,
          },
        },
      });
    },
    {
      timing: 'instant',
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }],
      trackedManaEffect: {
        kind: 'etb-counter-on-non-human-creature',
        counterType: '+1/+1',
        amount: 1,
      },
      description: '{T}: Add one mana of any color. If that mana is spent to cast a non-Human creature spell, that creature enters with an additional +1/+1 counter on it.',
    },
  )
  .build();
