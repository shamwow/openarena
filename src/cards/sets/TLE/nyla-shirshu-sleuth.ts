import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const NylaShirshuSleuth = CardBuilder.create('Nyla, Shirshu Sleuth')
  .cost('{4}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Mole', 'Beast')
  .stats(4, 5)
  .etbEffect(async (ctx) => {
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const creatureCards = graveyard.filter(c => c.definition.types.includes(CardType.CREATURE));
    if (creatureCards.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Exile up to one target creature card from your graveyard', creatureCards, 1, c => c.definition.name);
      for (const target of chosen) {
        const mv = target.definition.cost?.mana
          ? (target.definition.cost.mana.generic + target.definition.cost.mana.W + target.definition.cost.mana.U + target.definition.cost.mana.B + target.definition.cost.mana.R + target.definition.cost.mana.G + target.definition.cost.mana.C)
          : 0;
        ctx.game.exilePermanent(target.objectId);
        ctx.game.loseLife(ctx.controller, mv);
        for (let i = 0; i < mv; i++) {
          ctx.game.createPredefinedToken(ctx.controller, 'Clue');
        }
      }
    }
  }, { description: 'When Nyla enters, exile up to one target creature card from your graveyard. If you do, you lose X life and create X Clue tokens, where X is that card\'s mana value.' })
  .triggered(
    { on: 'end-step', whose: 'yours' },
    async (ctx) => {
      const clues = ctx.game.getBattlefield({ subtypes: ['Clue'], controller: 'you' }, ctx.controller);
      if (clues.length === 0) {
        // TODO: Return target card exiled with Nyla to its owner's hand
      }
    },
    { description: 'At the beginning of your end step, if you control no Clues, return target card exiled with Nyla to its owner\'s hand.' },
  )
  .build();
