import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createHasteAbilities } from '../../../engine/AbilityPrimitives';

export const MomosHeist = CardBuilder.create("Momo's Heist")
  .cost('{2}{R}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const artifacts = ctx.game.getBattlefield({ types: [CardType.ARTIFACT] });
    if (artifacts.length === 0) return;
    const target = await ctx.choices.chooseOne('Gain control of target artifact', artifacts, c => c.definition.name);
    ctx.game.changeControl(target.objectId, ctx.controller, { type: 'until-end-of-turn' });
    ctx.game.untapPermanent(target.objectId);
    ctx.game.grantAbilitiesUntilEndOfTurn(
      ctx.source.objectId,
      target.objectId,
      target.zoneChangeCounter,
      createHasteAbilities(),
    );
    // TODO: At the beginning of the next end step, sacrifice it
    ctx.game.registerDelayedTrigger({
      trigger: { on: 'end-step', whose: 'each' },
      effect: (innerCtx) => {
        ctx.game.sacrificePermanent(target.objectId, ctx.controller);
      },
      once: true,
      description: 'At the beginning of the next end step, sacrifice it.',
    });
  }, { description: 'Gain control of target artifact. Untap it. It gains haste. At the beginning of the next end step, sacrifice it.' })
  .build();
