import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const BisonWhistle = CardBuilder.create('Bison Whistle')
  .cost('{1}{G}')
  .types(CardType.ARTIFACT)
  .activated(
    { mana: parseManaCost('{1}'), tap: true },
    async (ctx) => {
      const library = ctx.game.getLibrary(ctx.controller);
      if (library.length === 0) return;
      const topCard = library[0];
      const isBison = topCard.definition.subtypes.includes('Bison');
      const isCreature = topCard.definition.types.includes(CardType.CREATURE);

      if (isBison) {
        const putOnBattlefield = await ctx.choices.chooseYesNo(`Top card is ${topCard.definition.name} (Bison). Put it onto the battlefield?`);
        if (putOnBattlefield) {
          ctx.game.moveCard(topCard.objectId, 'BATTLEFIELD', ctx.controller);
          return;
        }
      }
      if (isCreature) {
        const putInHand = await ctx.choices.chooseYesNo(`Top card is ${topCard.definition.name} (creature). Reveal and put into your hand?`);
        if (putInHand) {
          ctx.game.moveCard(topCard.objectId, 'HAND', ctx.controller);
          return;
        }
      }
      const putInGraveyard = await ctx.choices.chooseYesNo(`Put ${topCard.definition.name} into your graveyard?`);
      if (putInGraveyard) {
        ctx.game.moveCard(topCard.objectId, 'GRAVEYARD', ctx.controller);
      }
    },
    { description: '{1}, {T}: Look at the top card of your library. If it\'s a Bison, you may put it onto the battlefield. If creature, reveal and put into hand. Otherwise, may put into graveyard.' }
  )
  .build();
