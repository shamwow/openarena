import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createLifelinkAbilities } from '../../../engine/AbilityPrimitives';

export const LoAndLiTwinTutors = CardBuilder.create('Lo and Li, Twin Tutors')
  .cost('{4}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Advisor')
  .stats(2, 2)
  .etbEffect(async (ctx) => {
    await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: {
        custom: (card) =>
          card.definition.subtypes.includes('Lesson') || card.definition.subtypes.includes('Noble'),
      },
      destination: 'HAND',
      count: 1,
      reveal: true,
    });
  }, { description: 'When Lo and Li enter, search your library for a Lesson or Noble card, reveal it, put it into your hand, then shuffle.' })
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: createLifelinkAbilities(),
      filter: { subtypes: ['Noble'], types: [CardType.CREATURE], controller: 'you' },
    },
    { description: 'Noble creatures you control and Lesson spells you control have lifelink.' },
  )
  // TODO: Lesson spells having lifelink (spell-based lifelink is unusual)
  .build();
