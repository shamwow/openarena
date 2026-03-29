import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const HonestWork = CardBuilder.create('Honest Work')
  .cost('{U}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Aura')
  .enchant({ what: 'creature', count: 1 })
  .etbEffect(async (ctx) => {
    // Tap enchanted creature and remove all counters
    if (ctx.source.attachedTo) {
      ctx.game.tapPermanent(ctx.source.attachedTo);
      // TODO: Remove all counters from enchanted creature
    }
  }, { description: 'When this Aura enters, tap enchanted creature and remove all counters from it.' })
  // TODO: Enchanted creature loses all abilities, becomes a 1/1 Citizen named Humble Merchant with "{T}: Add {C}"
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        if (!source.attachedTo) return;
        // TODO: Properly remove abilities and set base stats
        for (const pid of game.turnOrder) {
          for (const card of game.zones[pid].BATTLEFIELD) {
            if (card.objectId === source.attachedTo) {
              card.modifiedPower = 1;
              card.modifiedToughness = 1;
              break;
            }
          }
        }
      },
    },
    { description: 'Enchanted creature loses all abilities and is a Citizen with base power and toughness 1/1 and "{T}: Add {C}" named Humble Merchant.' },
  )
  .build();
