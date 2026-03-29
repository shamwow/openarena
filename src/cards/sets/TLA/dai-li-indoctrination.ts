import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DaiLiIndoctrination = CardBuilder.create('Dai Li Indoctrination')
  .cost('{1}{B}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .modal([
    {
      label: 'Target opponent reveals their hand. You choose a nonland permanent card from it. That player discards that card.',
      effect: async (ctx) => {
        const opponents = ctx.game.getOpponents(ctx.controller);
        if (opponents.length === 0) return;
        const target = await ctx.choices.choosePlayer('Choose target opponent', opponents);
        const hand = ctx.game.getHand(target);
        const nonlandPermanents = hand.filter(c =>
          !c.definition.types.includes(CardType.LAND) &&
          (c.definition.types.includes(CardType.CREATURE) ||
           c.definition.types.includes(CardType.ARTIFACT) ||
           c.definition.types.includes(CardType.ENCHANTMENT) ||
           c.definition.types.includes(CardType.PLANESWALKER))
        );
        if (nonlandPermanents.length > 0) {
          const chosen = await ctx.choices.chooseOne('Choose a nonland permanent card to discard', nonlandPermanents, c => c.definition.name);
          ctx.game.discardCard(target, chosen.objectId);
        }
      },
    },
    {
      label: 'Earthbend 2.',
      effect: async (ctx) => {
        const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
        if (lands.length > 0) {
          const target = await ctx.choices.chooseOne('Choose a land to earthbend 2', lands, c => c.definition.name);
          ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
        }
      },
    },
  ], 1, 'Choose one —')
  .build();
