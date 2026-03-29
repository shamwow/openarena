import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const EarthRumble = CardBuilder.create('Earth Rumble')
  .cost('{3}{G}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    // Earthbend 2
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a land to earthbend 2', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
    }
    // Up to one target creature you control fights target creature an opponent controls
    const yourCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c => c.controller !== ctx.controller);
    if (yourCreatures.length > 0 && oppCreatures.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Choose up to one creature you control to fight', yourCreatures, 1, c => c.definition.name);
      if (chosen.length > 0) {
        const oppTarget = await ctx.choices.chooseOne('Choose a creature an opponent controls to fight', oppCreatures, c => c.definition.name);
        ctx.game.fight(chosen[0].objectId, oppTarget.objectId);
      }
    }
  }, { description: 'Earthbend 2. When you do, up to one target creature you control fights target creature an opponent controls.' })
  .build();
