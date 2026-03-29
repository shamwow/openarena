import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFirstStrikeAbilities } from '../../../engine/AbilityPrimitives';

export const ZukoSeekingHonor = CardBuilder.create('Zuko, Seeking Honor')
  .cost('{2}{B/R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble')
  .stats(2, 2)
  .firebending(1)
  .triggered(
    {
      on: 'cast-spell',
      filter: {
        controller: 'you',
        custom: (card) => !card.spellTypes?.includes(CardType.CREATURE),
      },
    },
    (ctx) => {
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        ctx.source.objectId,
        ctx.source.zoneChangeCounter,
        createFirstStrikeAbilities(),
      );
    },
    { description: 'Whenever you cast a noncreature spell, Zuko gains first strike until end of turn.' },
  )
  .triggered(
    { on: 'deals-damage', filter: { self: true }, damageType: 'combat' },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever Zuko deals combat damage to a player, put a +1/+1 counter on him.' },
  )
  .build();
