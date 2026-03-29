import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DesperatePlea = CardBuilder.create('Desperate Plea')
  .cost('{1}{B}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  // TODO: "As an additional cost, sacrifice a creature" and track its power for mode 1
  .modal([
    {
      label: "Return target creature card from your graveyard to the battlefield if its power is less than or equal to the sacrificed creature's power.",
      effect: async (ctx) => {
        // TODO: Need to track sacrificed creature's power
        const graveyard = ctx.game.getGraveyard(ctx.controller);
        const creatureCards = graveyard.filter(c => c.definition.types.includes(CardType.CREATURE));
        if (creatureCards.length > 0) {
          const target = await ctx.choices.chooseOne('Choose a creature card to return', creatureCards, c => c.definition.name);
          ctx.game.moveCard(target.objectId, 'BATTLEFIELD', ctx.controller);
        }
      },
    },
    {
      label: 'Destroy target creature.',
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Destroy target creature', creatures, c => c.definition.name);
          ctx.game.destroyPermanent(target.objectId);
        }
      },
    },
  ], 1, 'Choose one or both —')
  .build();
