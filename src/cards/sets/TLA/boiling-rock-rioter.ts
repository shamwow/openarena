import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BoilingRockRioter = CardBuilder.create('Boiling Rock Rioter')
  .cost('{2}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Rogue', 'Ally')
  .stats(3, 3)
  .firebending(1)
  .activated(
    { custom: () => true },
    async (ctx) => {
      // Tap an untapped Ally you control to exile target card from a graveyard
      const allies = ctx.game.getBattlefield({ subtypes: ['Ally'], controller: 'you', tapped: false }, ctx.controller);
      if (allies.length === 0) return;
      const ally = await ctx.choices.chooseOne('Tap an untapped Ally you control', allies, c => c.definition.name);
      ctx.game.tapPermanent(ally.objectId);

      const opponents = ctx.game.getOpponents(ctx.controller);
      const allGraveyards: any[] = [];
      for (const player of [ctx.controller, ...opponents]) {
        const gy = ctx.game.getGraveyard(player);
        allGraveyards.push(...gy);
      }
      if (allGraveyards.length > 0) {
        const target = await ctx.choices.chooseOne('Exile target card from a graveyard', allGraveyards, c => c.definition.name);
        ctx.game.moveCard(target.objectId, 'EXILE', target.owner);
      }
    },
    { description: 'Tap an untapped Ally you control: Exile target card from a graveyard.' }
  )
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      // TODO: You may cast an Ally spell from among cards you own exiled with this creature
    },
    { description: 'Whenever this creature attacks, you may cast an Ally spell from among cards you own exiled with this creature.' }
  )
  .build();
