import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const EarthKingdomSoldier = CardBuilder.create('Earth Kingdom Soldier')
  .cost('{4}{G/W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(3, 4)
  .vigilance()
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length === 0) return;
    const chosen = await ctx.choices.chooseUpToN(
      'Put a +1/+1 counter on each of up to two target creatures you control',
      creatures,
      2,
      c => c.definition.name,
    );
    for (const target of chosen) {
      ctx.game.addCounters(target.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    }
  }, { description: 'When this creature enters, put a +1/+1 counter on each of up to two target creatures you control.' })
  .build();
