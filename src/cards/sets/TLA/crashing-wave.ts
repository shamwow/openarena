import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CrashingWave = CardBuilder.create('Crashing Wave')
  .cost('{U}{U}')
  .types(CardType.SORCERY)
  // TODO: waterbend X as additional cost is dynamic; using a simplified version
  .spellEffect(async (ctx) => {
    // Tap up to X target creatures (X comes from waterbend cost)
    // Simplified: let player choose creatures to tap, then distribute 3 stun counters
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    const opponentCreatures = creatures.filter(c => c.controller !== ctx.controller);
    if (opponentCreatures.length > 0) {
      const toTap = await ctx.choices.chooseUpToN(
        'Choose creatures to tap',
        opponentCreatures,
        opponentCreatures.length,
        c => c.definition.name
      );
      for (const creature of toTap) {
        ctx.game.tapPermanent(creature.objectId);
      }
    }
    // Distribute 3 stun counters among tapped opponent creatures
    const tappedOpponentCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] })
      .filter(c => c.controller !== ctx.controller && c.tapped);
    let stunRemaining = 3;
    while (stunRemaining > 0 && tappedOpponentCreatures.length > 0) {
      const target = await ctx.choices.chooseOne(
        `Distribute stun counter (${stunRemaining} remaining)`,
        tappedOpponentCreatures,
        c => c.definition.name
      );
      ctx.game.addCounters(target.objectId, 'stun', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
      stunRemaining--;
    }
  }, { description: 'Tap up to X target creatures, then distribute three stun counters among tapped opponent creatures.' })
  .build();
