import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const NightmaresAndDaydreams = CardBuilder.create('Nightmares and Daydreams')
  .cost('{2}{U}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Saga')
  .saga([
    {
      chapter: 1,
      effect: (ctx) => {
        // TODO: Until your next turn, whenever you cast an instant or sorcery spell, target player mills cards equal to that spell's mana value
      },
    },
    {
      chapter: 2,
      effect: (ctx) => {
        // Same as chapter 1
        // TODO: Until your next turn, whenever you cast an instant or sorcery spell, target player mills cards equal to that spell's mana value
      },
    },
    {
      chapter: 3,
      effect: (ctx) => {
        // Same as chapter 1 and 2
        // TODO: Until your next turn, whenever you cast an instant or sorcery spell, target player mills cards equal to that spell's mana value
      },
    },
    {
      chapter: 4,
      effect: (ctx) => {
        const allGraveyards = ctx.game.getActivePlayers().map(p => ctx.game.getGraveyard(p));
        const hasLargeGraveyard = allGraveyards.some(gy => gy.length >= 20);
        ctx.game.drawCards(ctx.controller, hasLargeGraveyard ? 3 : 1);
      },
    },
  ])
  .build();
