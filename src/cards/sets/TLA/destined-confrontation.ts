import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DestinedConfrontation = CardBuilder.create('Destined Confrontation')
  .cost('{2}{W}{W}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const allPlayers = [ctx.controller, ...ctx.game.getOpponents(ctx.controller)];
    for (const player of allPlayers) {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, player);
      if (creatures.length === 0) continue;
      // Player chooses creatures with total power 4 or less to keep
      const kept = await ctx.choices.chooseUpToN(
        'Choose creatures with total power 4 or less to keep',
        creatures,
        creatures.length,
        c => `${c.definition.name} (${c.modifiedPower ?? c.definition.power ?? 0}/${c.modifiedToughness ?? c.definition.toughness ?? 0})`
      );
      // TODO: Validate total power <= 4
      const keptIds = new Set(kept.map(c => c.objectId));
      for (const creature of creatures) {
        if (!keptIds.has(creature.objectId)) {
          ctx.game.sacrificePermanents(player, { custom: (c) => c.objectId === creature.objectId }, 1, 'Sacrifice');
        }
      }
    }
  }, { description: 'Each player chooses any number of creatures they control with total power 4 or less, then sacrifices all other creatures they control.' })
  .build();
