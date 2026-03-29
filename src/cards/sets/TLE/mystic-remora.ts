import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType, parseManaCost } from '../../../engine/types';

export const MysticRemora = CardBuilder.create('Mystic Remora')
  .cost('{U}')
  .types(CardType.ENCHANTMENT)
  .cumulativeUpkeep('{1}')
  .triggered(
    {
      on: 'custom',
      match: (event, source) =>
        event.type === GameEventType.SPELL_CAST &&
        event.castBy !== source.controller &&
        !event.spellTypes.includes(CardType.CREATURE),
    },
    async (ctx) => {
      if (!ctx.event || ctx.event.type !== GameEventType.SPELL_CAST) {
        return;
      }

      const paid = await ctx.game.unlessPlayerPays(
        ctx.event.castBy,
        ctx.source.objectId,
        { mana: parseManaCost('{4}') },
        'Pay {4} to prevent Mystic Remora from drawing a card?',
      );
      if (paid) {
        return;
      }

      const draw = await ctx.choices.chooseYesNo('Draw a card?');
      if (draw) {
        ctx.game.drawCards(ctx.controller, 1);
      }
    },
    {
      description: 'Whenever an opponent casts a noncreature spell, you may draw a card unless that player pays {4}.',
    },
  )
  .build();
