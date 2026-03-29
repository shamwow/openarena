import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SandbenderScavengers = CardBuilder.create('Sandbender Scavengers')
  .cost('{W}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Rogue')
  .stats(1, 1)
  .triggered(
    { on: 'sacrifice', filter: { controller: 'you' } },
    async (ctx) => {
      // TODO: "another permanent" — should exclude self from trigger
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever you sacrifice another permanent, put a +1/+1 counter on this creature.' },
  )
  .diesEffect(async (ctx) => {
    // May exile it. When you do, return target creature card with MV <= power from graveyard to battlefield.
    const exileChoice = await ctx.choices.chooseYesNo('Exile Sandbender Scavengers?');
    if (!exileChoice) return;
    ctx.game.moveCard(ctx.source.objectId, 'EXILE');
    const power = ctx.source.modifiedPower ?? ctx.source.definition.power ?? 1;
    const graveyard = ctx.game.getGraveyard(ctx.controller).filter(
      c => c.definition.types.includes(CardType.CREATURE) && (c.definition.cost?.mana ? Object.values(c.definition.cost.mana).reduce((a, b) => a + b, 0) : 0) <= power
    );
    if (graveyard.length === 0) return;
    const target = await ctx.choices.chooseOne('Return target creature card to the battlefield', graveyard, c => c.definition.name);
    ctx.game.moveCard(target.objectId, 'BATTLEFIELD', ctx.controller);
  }, { description: 'When this creature dies, you may exile it. When you do, return target creature card with mana value less than or equal to this creature\'s power from your graveyard to the battlefield.' })
  .build();
