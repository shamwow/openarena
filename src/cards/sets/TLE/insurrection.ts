import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createHasteAbilities } from '../../../engine/AbilityPrimitives';

export const Insurrection = CardBuilder.create('Insurrection')
  .cost('{5}{R}{R}{R}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const allCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    for (const creature of allCreatures) {
      ctx.game.untapPermanent(creature.objectId);
      // TODO: Properly gain control of all creatures until end of turn
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        creature.objectId,
        creature.zoneChangeCounter,
        createHasteAbilities(),
      );
    }
  }, { description: 'Untap all creatures and gain control of them until end of turn. They gain haste until end of turn.' })
  .build();
