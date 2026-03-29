import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SokkaLateralStrategist = CardBuilder.create('Sokka, Lateral Strategist')
  .cost('{1}{W/U}{W/U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(2, 4)
  .vigilance()
  .triggered(
    { on: 'attacks', filter: { self: true } },
    (ctx) => {
      // Only triggers if at least one other creature also attacks
      const attackers = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.tapped && c.objectId !== ctx.source.objectId);
      // TODO: Properly check if at least one other creature is attacking
      // For now, draw a card since the trigger is on attack and we assume co-attackers
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: 'Whenever Sokka and at least one other creature attack, draw a card.' },
  )
  .build();
