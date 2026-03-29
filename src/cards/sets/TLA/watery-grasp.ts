import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const WateryGrasp = CardBuilder.create('Watery Grasp')
  .cost('{U}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Aura')
  .enchant({ what: 'creature', count: 1 })
  .staticAbility(
    {
      type: 'custom',
      apply: (_game, _source) => {
        // TODO: Enchanted creature doesn't untap during its controller's untap step
      },
    },
    { description: 'Enchanted creature doesn\'t untap during its controller\'s untap step.' },
  )
  .activated(
    { mana: parseManaCost('{5}') },
    async (ctx) => {
      if (ctx.source.attachedTo) {
        const host = ctx.game.getCard(ctx.source.attachedTo);
        if (host) {
          // Shuffle enchanted creature into its owner's library
          ctx.game.moveCard(host.objectId, 'LIBRARY', host.owner);
          ctx.game.shuffleLibrary(host.owner);
        }
      }
    },
    {
      description: 'Waterbend {5}: Enchanted creature\'s owner shuffles it into their library.',
    },
  )
  .waterbend(5)
  .build();
