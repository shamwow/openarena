import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const SuspiciousBookcase = CardBuilder.create('Suspicious Bookcase')
  .cost('{2}')
  .types(CardType.ARTIFACT, CardType.CREATURE)
  .subtypes('Wall')
  .stats(0, 4)
  .defender()
  .activated(
    { mana: parseManaCost('{3}'), tap: true },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
      if (creatures.length === 0) return;
      const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
      // TODO: Grant "can't be blocked this turn" to target
    },
    { description: '{3}, {T}: Target creature can\'t be blocked this turn.' },
  )
  .build();
