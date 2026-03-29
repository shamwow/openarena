import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { getEffectiveSubtypes } from '../../../engine/GameState';

export const RanAndShaw = CardBuilder.create('Ran and Shaw')
  .cost('{3}{R}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Dragon')
  .stats(4, 4)
  .flying()
  .firebending(2)
  .etbEffect(async (ctx) => {
    // Check if cast and 3+ Dragon/Lesson cards in graveyard
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const qualifying = graveyard.filter(c =>
      getEffectiveSubtypes(c).includes('Dragon') || getEffectiveSubtypes(c).includes('Lesson')
    );
    if (qualifying.length >= 3) {
      // TODO: "if you cast them" check
      const token = ctx.game.copyPermanent(ctx.source.objectId, ctx.controller);
      if (token) {
        token.definition = { ...token.definition, supertypes: [] };
      }
    }
  }, { description: 'When Ran and Shaw enter, if you cast them and there are three or more Dragon and/or Lesson cards in your graveyard, create a token that\'s a copy of Ran and Shaw, except it\'s not legendary.' })
  .activated(
    { mana: parseManaCost('{3}{R}') },
    async (ctx) => {
      const dragons = ctx.game.getBattlefield({ subtypes: ['Dragon'], controller: 'you' }, ctx.controller);
      const ids = dragons.map(c => c.objectId);
      ctx.game.grantPumpToObjectsUntilEndOfTurn(ids, 2, 0);
    },
    { description: '{3}{R}: Dragons you control get +2/+0 until end of turn.' },
  )
  .build();
