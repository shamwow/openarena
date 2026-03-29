import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFlyingAbilities } from '../../../engine/AbilityPrimitives';

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
      const attackers = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.objectId !== ctx.source.objectId && c.tapped);
      // TODO: Should filter to "attacking creatures without flying"
      const eligibleAttackers = attackers.filter(c => {
        const abilities = c.modifiedAbilities ?? c.definition.abilities;
        return !abilities.some(a =>
          a.kind === 'static' && 'effect' in a && a.effect &&
          'type' in a.effect && a.effect.type === 'block-rule' &&
          'evasion' in a.effect && a.effect.evasion === 'requires-flying-or-reach'
        );
      });
      if (eligibleAttackers.length > 0) {
        const target = await ctx.choices.chooseOne('Choose another attacking creature without flying', eligibleAttackers, c => c.definition.name);
        ctx.game.grantAbilitiesUntilEndOfTurn(ctx.source.objectId, target.objectId, target.zoneChangeCounter, createFlyingAbilities());
      }
    },
    { description: 'Whenever Appa attacks, another target attacking creature without flying gains flying until end of turn.' }
  )
  .build();
