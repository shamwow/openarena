import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BumiKingOfThreeTrials = CardBuilder.create('Bumi, King of Three Trials')
  .cost('{5}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(4, 4)
  .etbEffect(async (ctx) => {
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const lessonCount = graveyard.filter(c => c.definition.subtypes.includes('Lesson')).length;
    if (lessonCount === 0) return;

    const modes = [
      'Put three +1/+1 counters on Bumi',
      'Target player scries 3',
      'Earthbend 3',
    ];
    const chosen = await ctx.choices.chooseUpToN(`Choose up to ${lessonCount} modes`, modes, Math.min(lessonCount, 3), m => m);

    for (const mode of chosen) {
      if (mode === 'Put three +1/+1 counters on Bumi') {
        ctx.game.addCounters(ctx.source.objectId, '+1/+1', 3, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      } else if (mode === 'Target player scries 3') {
        await ctx.game.scry(ctx.controller, 3);
      } else if (mode === 'Earthbend 3') {
        const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
        if (lands.length > 0) {
          const target = await ctx.choices.chooseOne('Choose a land to earthbend 3', lands, c => c.definition.name);
          ctx.game.earthbendLand(target.objectId, 3, ctx.controller);
        }
      }
    }
  }, { description: 'When Bumi enters, choose up to X modes where X is the number of Lesson cards in your graveyard.' })
  .build();
