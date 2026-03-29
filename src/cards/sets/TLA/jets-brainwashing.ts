import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createHasteAbilities } from '../../../engine/AbilityPrimitives';

export const JetsBrainwashing = CardBuilder.create("Jet's Brainwashing")
  .cost('{R}')
  .types(CardType.SORCERY)
  .kicker('{3}')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);

    // TODO: Grant "can't block" until end of turn

    if (ctx.costsPaid?.kicked) {
      ctx.game.changeControl(target.objectId, ctx.controller, { type: 'until-end-of-turn' });
      ctx.game.untapPermanent(target.objectId);
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        target.objectId,
        target.zoneChangeCounter,
        createHasteAbilities(),
      );
    }

    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: "Kicker {3}. Target creature can't block this turn. If kicked, gain control until end of turn, untap it, grant haste. Create a Clue token." })
  .build();
