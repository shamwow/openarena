import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const VolcanicTorrent = CardBuilder.create('Volcanic Torrent')
  .cost('{4}{R}')
  .types(CardType.SORCERY)
  .cascade()
  .spellEffect(async (ctx) => {
    // X = number of spells cast this turn
    const spellsCastThisTurn = ctx.state.eventLog.filter(
      e => e.type === GameEventType.SPELL_CAST &&
        e.timestamp >= (ctx.state.turnStartTimestamp ?? 0),
    ).length;
    const x = spellsCastThisTurn;
    const opponents = ctx.game.getOpponents(ctx.controller);
    const oppCreaturesAndPlaneswalkers = ctx.game.getBattlefield().filter(c =>
      opponents.includes(c.controller) &&
      (c.definition.types.includes(CardType.CREATURE) || c.definition.types.includes('Planeswalker' as CardType)),
    );
    for (const perm of oppCreaturesAndPlaneswalkers) {
      ctx.game.dealDamage(ctx.source.objectId, perm.objectId, x, false);
    }
  }, { description: 'Volcanic Torrent deals X damage to each creature and planeswalker your opponents control, where X is the number of spells you\'ve cast this turn.' })
  .build();
