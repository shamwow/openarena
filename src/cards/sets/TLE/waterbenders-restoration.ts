import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const WaterbendersRestoration = CardBuilder.create("Waterbender's Restoration")
  .cost('{U}{U}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  // TODO: As an additional cost, waterbend X — X is variable
  .spellEffect(async (ctx) => {
    // TODO: Properly get X from waterbend cost paid
    const x = ctx.xValue ?? 1;
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length > 0) {
      const targets = await ctx.choices.chooseUpToN(`Exile up to ${x} creatures you control`, creatures, x, c => c.definition.name);
      for (const target of targets) {
        ctx.game.exilePermanent(target.objectId);
      }
      // TODO: Register delayed trigger — return at beginning of next end step
    }
  }, { description: 'Exile X target creatures you control. Return those cards to the battlefield under their owner\'s control at the beginning of the next end step.' })
  .build();
