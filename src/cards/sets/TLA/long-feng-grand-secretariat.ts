import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const LongFengGrandSecretariat = CardBuilder.create('Long Feng, Grand Secretariat')
  .cost('{1}{B/G}{B/G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Advisor')
  .stats(2, 3)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        // Trigger when another creature you control or a land you control goes to graveyard from battlefield
        if (event.type !== GameEventType.ZONE_CHANGE) return false;
        if (event.to !== 'GRAVEYARD' || event.from !== 'BATTLEFIELD') return false;
        if (event.controller !== source.controller) return false;
        if (event.objectId === source.objectId) return false;
        const card = game.findCardByObjectId?.(event.objectId);
        if (!card) return true; // If we can't find the card, assume it matches
        return card.definition.types.includes(CardType.CREATURE) || card.definition.types.includes(CardType.LAND);
      },
    },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      if (creatures.length === 0) return;
      const target = await ctx.choices.chooseOne(
        'Put a +1/+1 counter on target creature you control',
        creatures,
        c => c.definition.name,
      );
      ctx.game.addCounters(target.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever another creature you control or a land you control is put into a graveyard from the battlefield, put a +1/+1 counter on target creature you control.' },
  )
  .build();
