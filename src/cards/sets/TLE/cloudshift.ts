import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Cloudshift = CardBuilder.create('Cloudshift')
  .cost('{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Exile target creature you control', creatures, c => c.definition.name);
    ctx.game.moveCard(target.objectId, 'EXILE', ctx.controller);
    // Return that card to the battlefield under your control
    ctx.game.moveCard(target.objectId, 'BATTLEFIELD', ctx.controller);
  }, { description: 'Exile target creature you control, then return that card to the battlefield under your control.' })
  .build();
