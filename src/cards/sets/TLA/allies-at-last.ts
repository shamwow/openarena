import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AlliesAtLast = CardBuilder.create('Allies at Last')
  .cost('{2}{G}')
  .types(CardType.INSTANT)
  .affinity({ subtypes: ['Ally'], controller: 'you' }, 'Affinity for Allies')
  .spellEffect(async (ctx) => {
    // Choose up to two creatures you control and one creature an opponent controls
    const myCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    const opponents = ctx.game.getOpponents(ctx.controller);
    const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'opponent' }, ctx.controller);
    if (myCreatures.length === 0 || oppCreatures.length === 0) return;

    const chosen = await ctx.choices.chooseUpToN('Choose up to two creatures you control', myCreatures, 2, c => c.definition.name);
    const target = await ctx.choices.chooseOne('Choose target creature an opponent controls', oppCreatures, c => c.definition.name);

    for (const attacker of chosen) {
      const power = attacker.modifiedPower ?? attacker.definition.power ?? 0;
      ctx.game.dealDamage(attacker.objectId, target.objectId, power, false);
    }
  }, { description: 'Up to two target creatures you control each deal damage equal to their power to target creature an opponent controls.' })
  .build();
