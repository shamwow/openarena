import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFlyingAbilities, hasAbilityDescription } from '../../../engine/AbilityPrimitives';

export const AppaAangsCompanion = CardBuilder.create("Appa, Aang's Companion")
  .cost('{3}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Bison', 'Ally')
  .stats(2, 4)
  .flying()
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const combat = ctx.state.combat;
      const eligibleAttackers = combat
        ? ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
          .filter((card) =>
            card.objectId !== ctx.source.objectId
            && combat.attackers.has(card.objectId)
            && !hasAbilityDescription(card, 'Flying', ctx.state),
          )
        : [];
      if (eligibleAttackers.length > 0) {
        const target = await ctx.choices.chooseOne('Choose another attacking creature without flying', eligibleAttackers, c => c.definition.name);
        ctx.game.grantAbilitiesUntilEndOfTurn(ctx.source.objectId, target.objectId, target.zoneChangeCounter, createFlyingAbilities());
      }
    },
    { description: 'Whenever Appa attacks, another target attacking creature without flying gains flying until end of turn.' }
  )
  .build();
