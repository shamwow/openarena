import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const TheBlueSpirit = CardBuilder.create('The Blue Spirit')
  .cost('{3}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Rogue', 'Ally')
  .stats(2, 4)
  // TODO: First creature spell each turn has flash
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Grant flash to the first creature spell cast each turn
      },
    },
    { description: 'You may cast the first creature spell you cast each turn as though it had flash.' },
  )
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (event.controller !== source.controller) return false;
        // Check if during combat and nontoken
        const card = game.zones[event.controller]?.BATTLEFIELD.find(c => c.objectId === event.objectId);
        if (!card || card.isToken) return false;
        if (!card.definition.types.includes('Creature' as any)) return false;
        return game.currentPhase === 'COMBAT';
      },
    },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: 'Whenever a nontoken creature you control enters during combat, draw a card.' },
  )
  .build();
