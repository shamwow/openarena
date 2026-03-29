import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { getEffectiveSubtypes } from '../../../engine/GameState';

export const HaruHiddenTalent = CardBuilder.create('Haru, Hidden Talent')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Peasant', 'Ally')
  .stats(1, 1)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (event.controller !== source.controller) return false;
        if (event.objectId === source.objectId) return false;
        const enteringCard = game.zones[event.controller]?.BATTLEFIELD.find(c => c.objectId === event.objectId);
        return Boolean(enteringCard && getEffectiveSubtypes(enteringCard).includes('Ally'));
      },
    },
    async (ctx) => {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend 1', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, 1, ctx.controller);
      }
    },
    { description: 'Whenever another Ally you control enters, earthbend 1.' },
  )
  .build();
