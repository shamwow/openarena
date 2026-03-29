import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const RockyRebuke = CardBuilder.create('Rocky Rebuke')
  .cost('{1}{G}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const myCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }, ctx.controller);
    if (myCreatures.length === 0) return;
    const source = await ctx.choices.chooseOne('Choose a creature you control', myCreatures, c => c.definition.name);
    const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c => c.controller !== ctx.controller);
    if (oppCreatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature an opponent controls', oppCreatures, c => c.definition.name);
    const power = source.modifiedPower ?? source.definition.power ?? 0;
    ctx.game.dealDamage(source.objectId, target.objectId, power, false);
  }, { description: 'Target creature you control deals damage equal to its power to target creature an opponent controls.' })
  .build();
