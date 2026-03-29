import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const TheGreatHenge = CardBuilder.create('The Great Henge')
  .cost('{7}{G}{G}')
  .types(CardType.ARTIFACT)
  .supertypes('Legendary')
  // TODO: Costs {X} less where X is greatest power among creatures you control
  .activated(
    { tap: true },
    async (ctx) => {
      ctx.game.addMana(ctx.controller, 'G', 2);
      ctx.game.gainLife(ctx.controller, 2);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 2, colors: ['G'] }],
      description: '{T}: Add {G}{G}. You gain 2 life.',
    },
  )
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (event.controller !== source.controller) return false;
        const card = game.zones[event.controller]?.BATTLEFIELD.find(c => c.objectId === event.objectId);
        if (!card) return false;
        return !card.isToken && card.definition.types.includes('Creature' as any);
      },
    },
    async (ctx) => {
      // TODO: Identify the entering creature and put counter on it
      // For now, find the most recently entered nontoken creature
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => !c.isToken);
      if (creatures.length > 0) {
        const target = creatures[creatures.length - 1];
        ctx.game.addCounters(target.objectId, '+1/+1', 1, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: 'Whenever a nontoken creature you control enters, put a +1/+1 counter on it and draw a card.' },
  )
  .build();
