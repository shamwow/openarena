import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SakashimaOfAThousandFaces = CardBuilder.create('Sakashima of a Thousand Faces')
  .cost('{3}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Rogue')
  .stats(3, 1)
  .tag('partner')
  .etbEffect(async (ctx) => {
    // TODO: May enter as a copy of another creature you control, except it has Sakashima's other abilities
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
      .filter(c => c.objectId !== ctx.source.objectId);
    if (creatures.length === 0) return;
    const copyChoice = await ctx.choices.chooseYesNo('Have Sakashima enter as a copy of another creature you control?');
    if (copyChoice) {
      const target = await ctx.choices.chooseOne('Choose a creature to copy', creatures, c => c.definition.name);
      // TODO: Copy effect with retained abilities
      ctx.source.definition = { ...target.definition, name: 'Sakashima of a Thousand Faces' };
    }
  }, { optional: true, description: 'You may have Sakashima enter as a copy of another creature you control, except it has Sakashima\'s other abilities.' })
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: The "legend rule" doesn't apply to permanents you control.
      },
    },
    { description: 'The "legend rule" doesn\'t apply to permanents you control.' },
  )
  .build();
