import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AvatarDestiny = CardBuilder.create('Avatar Destiny')
  .cost('{2}{G}{G}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Aura')
  .enchant({ what: 'creature', filter: { controller: 'you' }, count: 1 })
  .grantToAttached({
    type: 'attached-pump',
    power: (game, source) => {
      if (!source.attachedTo) return 0;
      const controller = source.controller;
      const graveyard = game.zones[controller]?.GRAVEYARD ?? [];
      return graveyard.filter(c => c.definition.types.includes(CardType.CREATURE as any)).length;
    },
    toughness: (game, source) => {
      if (!source.attachedTo) return 0;
      const controller = source.controller;
      const graveyard = game.zones[controller]?.GRAVEYARD ?? [];
      return graveyard.filter(c => c.definition.types.includes(CardType.CREATURE as any)).length;
    },
  })
  // TODO: Enchanted creature is also an Avatar type
  // TODO: When enchanted creature dies, mill cards equal to its power, return this to hand and up to one creature card milled to battlefield
  .diesEffect(async (ctx) => {
    // Simplified: return this card to hand
    ctx.game.returnToHand(ctx.source.objectId);
  }, { description: 'When enchanted creature dies, mill cards equal to its power. Return this card to hand and up to one creature card milled this way to the battlefield.' })
  .build();
