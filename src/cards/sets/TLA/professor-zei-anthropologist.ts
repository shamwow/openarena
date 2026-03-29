import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const ProfessorZeiAnthropologist = CardBuilder.create('Professor Zei, Anthropologist')
  .cost('{U/R}{U/R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Advisor', 'Ally')
  .stats(0, 3)
  .activated(
    { tap: true },
    async (ctx) => {
      const hand = ctx.game.getHand(ctx.controller);
      if (hand.length === 0) return;
      const toDiscard = await ctx.choices.chooseOne('Choose a card to discard', hand, c => c.definition.name);
      ctx.game.discardCard(ctx.controller, toDiscard.objectId);
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{T}, Discard a card: Draw a card.' },
  )
  .activated(
    { mana: parseManaCost('{1}'), tap: true, sacrifice: { self: true } },
    async (ctx) => {
      const graveyard = ctx.game.getGraveyard(ctx.controller).filter(
        c => c.definition.types.includes(CardType.INSTANT) || c.definition.types.includes(CardType.SORCERY),
      );
      if (graveyard.length === 0) return;
      const target = await ctx.choices.chooseOne(
        'Return target instant or sorcery card from your graveyard to your hand',
        graveyard,
        c => c.definition.name,
      );
      ctx.game.moveCard(target.objectId, 'HAND', ctx.controller);
    },
    {
      timing: 'sorcery',
      activateOnlyDuringYourTurn: true,
      description: '{1}, {T}, Sacrifice Professor Zei: Return target instant or sorcery card from your graveyard to your hand. Activate only during your turn.',
    },
  )
  .build();
