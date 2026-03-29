import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const MomoPlayfulPet = CardBuilder.create('Momo, Playful Pet')
  .cost('{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Lemur', 'Bat', 'Ally')
  .stats(1, 1)
  .flying()
  .vigilance()
  .triggered(
    { on: 'leave-battlefield', filter: { self: true } },
    async (ctx) => {
      const modes = [
        { label: 'Create a Food token', value: 'food' },
        { label: 'Put a +1/+1 counter on target creature you control', value: 'counter' },
        { label: 'Scry 2', value: 'scry' },
      ];
      const chosen = await ctx.choices.chooseOne('Choose one', modes, m => m.label);
      if (chosen.value === 'food') {
        ctx.game.createPredefinedToken(ctx.controller, 'Food');
      } else if (chosen.value === 'counter') {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Choose target creature you control', creatures, c => c.definition.name);
          ctx.game.addCounters(target.objectId, '+1/+1', 1);
        }
      } else {
        await ctx.game.scry(ctx.controller, 2);
      }
    },
    { description: 'When Momo leaves the battlefield, choose one: Create a Food token. / Put a +1/+1 counter on target creature you control. / Scry 2.' },
  )
  .build();
