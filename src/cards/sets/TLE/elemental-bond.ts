import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard } from '../../../engine/GameState';

export const ElementalBond = CardBuilder.create('Elemental Bond')
  .cost('{2}{G}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if ((event as any).controller !== source.controller) return false;
        const entering = findCard(game, (event as any).objectId, (event as any).objectZoneChangeCounter);
        if (!entering) return false;
        if (!entering.definition.types.includes(CardType.CREATURE as any)) return false;
        const power = entering.modifiedPower ?? entering.definition.power ?? 0;
        return power >= 3;
      },
    },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: 'Whenever a creature you control with power 3 or greater enters, draw a card.' }
  )
  .build();
