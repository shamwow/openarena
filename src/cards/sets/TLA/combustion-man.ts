import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CombustionMan = CardBuilder.create('Combustion Man')
  .cost('{3}{R}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Assassin')
  .supertypes('Legendary')
  .stats(4, 6)
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const permanents = ctx.game.getBattlefield();
      const opponentPermanents = permanents.filter(c => c.controller !== ctx.controller);
      if (opponentPermanents.length === 0) return;
      const target = await ctx.choices.chooseOne(
        'Choose target permanent to destroy unless its controller takes damage',
        opponentPermanents,
        c => c.definition.name
      );
      const power = ctx.source.modifiedPower ?? ctx.source.definition.power ?? 4;
      const acceptDamage = await ctx.choices.chooseYesNo(
        `Take ${power} damage from Combustion Man to save ${target.definition.name}?`
        // TODO: This choice should be made by the target's controller, not the attacker
      );
      if (!acceptDamage) {
        ctx.game.destroyPermanent(target.objectId);
      } else {
        ctx.game.dealDamage(ctx.source.objectId, target.controller, power, false);
      }
    },
    { description: 'Whenever Combustion Man attacks, destroy target permanent unless its controller has Combustion Man deal damage to them equal to his power.' }
  )
  .build();
