import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const HogMonkeyRampage = CardBuilder.create('Hog-Monkey Rampage')
  .cost('{1}{R/G}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const myCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (myCreatures.length === 0) return;
    const mine = await ctx.choices.chooseOne('Choose target creature you control', myCreatures, c => c.definition.name);

    const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(
      c => c.controller !== ctx.controller,
    );
    if (oppCreatures.length === 0) return;
    const theirs = await ctx.choices.chooseOne('Choose target creature an opponent controls', oppCreatures, c => c.definition.name);

    // Put a +1/+1 counter if your creature has power 4 or greater
    const power = mine.modifiedPower ?? mine.definition.power ?? 0;
    if (power >= 4) {
      ctx.game.addCounters(mine.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    }

    // Fight
    ctx.game.fight(mine.objectId, theirs.objectId);
  }, { description: 'Choose target creature you control and target creature an opponent controls. Put a +1/+1 counter on the creature you control if it has power 4 or greater. Then those creatures fight each other.' })
  .build();
