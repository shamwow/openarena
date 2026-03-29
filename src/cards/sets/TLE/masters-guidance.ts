import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const MastersGuidance = CardBuilder.create("Master's Guidance")
  .cost('{2}{G}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ATTACKS) return false;
        // Check if we attacked with 2+ legendary creatures this combat
        // TODO: Properly track attacking legendary creatures count
        const attackingLegendaries = game.turnOrder
          .flatMap(pid => game.zones[pid].BATTLEFIELD)
          .filter(c => c.definition.supertypes.includes('Legendary') && c.definition.types.includes('Creature') && c.tapped && c.controller === source.controller);
        return attackingLegendaries.length >= 2;
      },
    },
    async (ctx) => {
      const attacking = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you', tapped: true }, ctx.controller);
      if (attacking.length > 0) {
        const chosen = await ctx.choices.chooseUpToN('Put a +1/+1 counter on up to two target attacking creatures', attacking, 2, c => c.definition.name);
        for (const target of chosen) {
          ctx.game.addCounters(target.objectId, '+1/+1', 1);
        }
      }
    },
    { description: 'Whenever you attack with two or more legendary creatures, put a +1/+1 counter on each of up to two target attacking creatures.' },
  )
  .triggered(
    { on: 'end-step', whose: 'yours' },
    (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      const hasBigCreature = creatures.some(c => (c.modifiedPower ?? c.definition.power ?? 0) >= 4);
      if (hasBigCreature) {
        ctx.game.drawCards(ctx.controller, 1);
      }
    },
    { description: 'At the beginning of your end step, if you control a creature with power 4 or greater, draw a card.' },
  )
  .build();
