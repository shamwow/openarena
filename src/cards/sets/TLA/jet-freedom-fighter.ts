import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const JetFreedomFighter = CardBuilder.create('Jet, Freedom Fighter')
  .cost('{2}{R/W}{R/W}{R/W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(3, 1)
  .etbEffect(async (ctx) => {
    const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(
      c => c.controller !== ctx.controller,
    );
    if (oppCreatures.length === 0) return;
    const target = await ctx.choices.chooseOne(
      'Choose target creature an opponent controls',
      oppCreatures,
      c => c.definition.name,
    );
    const myCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    const damage = myCreatures.length;
    ctx.game.dealDamage(ctx.source.objectId, target.objectId, damage, false);
  }, { description: 'When Jet enters, he deals damage equal to the number of creatures you control to target creature an opponent controls.' })
  .diesEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const chosen = await ctx.choices.chooseUpToN(
      'Put a +1/+1 counter on each of up to two target creatures',
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
  }, { description: 'When Jet dies, put a +1/+1 counter on each of up to two target creatures.' })
  .build();
