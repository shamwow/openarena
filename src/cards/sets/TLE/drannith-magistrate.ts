import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DrannithMagistrate = CardBuilder.create('Drannith Magistrate')
  .cost('{1}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Wizard')
  .stats(1, 3)
  // TODO: "Your opponents can't cast spells from anywhere other than their hands."
  // This requires a complex interaction hook / static forbid
  .staticAbility(
    {
      type: 'interaction-hook',
      hook: {
        type: 'forbid',
        interactions: ['cast'],
        filter: { controller: 'opponent' },
        source: { zones: ['GRAVEYARD', 'EXILE', 'COMMAND', 'LIBRARY'] as any },
      },
    },
    { description: "Your opponents can't cast spells from anywhere other than their hands." }
  )
  .build();
