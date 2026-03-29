import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const RunAmok = CardBuilder.create('Run Amok')
  .cost('{1}{R}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const combat = ctx.state.combat;
    const creatures = combat
      ? ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter((card) => combat.attackers.has(card.objectId))
      : [];
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target attacking creature', creatures, c => c.definition.name);
    ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 3, 3);
    ctx.game.grantAbilitiesUntilEndOfTurn(
      ctx.source.objectId,
      target.objectId,
      target.zoneChangeCounter,
      createTrampleAbilities(),
    );
  }, { description: 'Target attacking creature gets +3/+3 and gains trample until end of turn.' })
  .build();
