import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FireLordAzula = CardBuilder.create('Fire Lord Azula')
  .cost('{1}{U}{B}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble')
  .stats(4, 4)
  .firebending(2)
  .triggered(
    {
      on: 'custom',
      match: (event, source) => {
        // Whenever you cast a spell while Fire Lord Azula is attacking
        if (event.type !== 'SPELL_CAST') return false;
        if ((event as any).controller !== source.controller) return false;
        // TODO: Check if Azula is currently attacking
        return source.tapped === true; // Approximation: tapped means attacking
      },
    },
    async (ctx) => {
      // TODO: Copy that spell. You may choose new targets for the copy.
      // This requires deep stack interaction to copy spells
    },
    { description: 'Whenever you cast a spell while Fire Lord Azula is attacking, copy that spell. You may choose new targets for the copy.' }
  )
  .build();
