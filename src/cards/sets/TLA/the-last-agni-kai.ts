import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TheLastAgniKai = CardBuilder.create('The Last Agni Kai')
  .cost('{1}{R}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const myCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (myCreatures.length === 0) return;
    const attacker = await ctx.choices.chooseOne('Choose a creature you control to fight', myCreatures, c => c.definition.name);
    const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c => c.controller !== ctx.controller);
    if (oppCreatures.length === 0) return;
    const defender = await ctx.choices.chooseOne('Choose a creature an opponent controls', oppCreatures, c => c.definition.name);
    ctx.game.fight(attacker.objectId, defender.objectId);
    // TODO: Track excess damage and add that much {R}
    // TODO: Until end of turn, you don't lose unspent red mana as steps and phases end
  }, { description: 'Target creature you control fights target creature an opponent controls. If excess damage, add that much {R}. Until end of turn, you don\'t lose unspent red mana.' })
  .build();
