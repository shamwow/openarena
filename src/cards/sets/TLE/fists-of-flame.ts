import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const FistsOfFlame = CardBuilder.create('Fists of Flame')
  .cost('{1}{R}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    ctx.game.drawCards(ctx.controller, 1);
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
    // Count cards drawn this turn
    const drawCount = ctx.game.getEventLog?.().filter(
      e => e.type === GameEventType.DREW_CARD && e.player === ctx.controller && e.turn === ctx.state.turn,
    ).length ?? 1;
    ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], drawCount, 0);
    ctx.game.grantAbilitiesUntilEndOfTurn(
      ctx.source.objectId,
      target.objectId,
      target.zoneChangeCounter,
      createTrampleAbilities(),
    );
  }, { description: 'Draw a card. Until end of turn, target creature gains trample and gets +1/+0 for each card you\'ve drawn this turn.' })
  .build();
