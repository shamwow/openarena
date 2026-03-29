import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DramaticReversal = CardBuilder.create('Dramatic Reversal')
  .cost('{1}{U}')
  .types(CardType.INSTANT)
  .spellEffect((ctx) => {
    const permanents = ctx.game.getBattlefield(undefined, ctx.controller);
    const nonlands = permanents.filter(c => !c.definition.types.includes(CardType.LAND));
    for (const perm of nonlands) {
      ctx.game.untapPermanent(perm.objectId);
    }
  }, { description: 'Untap all nonland permanents you control.' })
  .build();
