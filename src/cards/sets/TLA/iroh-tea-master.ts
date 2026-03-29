import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

export const IrohTeaMaster = CardBuilder.create('Iroh, Tea Master')
  .cost('{1}{R}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Citizen', 'Ally')
  .stats(2, 2)
  .etbEffect((ctx) => {
    ctx.game.createToken(ctx.controller, {
      name: 'Food',
      types: [CardType.ARTIFACT],
      subtypes: ['Food'],
      abilities: [{
        kind: 'activated' as const,
        cost: { mana: { generic: 2, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 }, tap: true, sacrifice: { self: true } },
        effect: (innerCtx) => {
          innerCtx.game.gainLife(innerCtx.controller, 3);
        },
        timing: 'instant' as const,
        isManaAbility: false,
        description: '{2}, {T}, Sacrifice this token: You gain 3 life.',
      }],
    });
  }, { description: 'When Iroh enters, create a Food token.' })
  .triggered(
    { on: 'step', step: 'COMBAT_BEGIN', whose: 'yours' },
    async (ctx) => {
      const opponents = ctx.game.getOpponents(ctx.controller);
      if (opponents.length === 0) return;
      const targetOpp = await ctx.choices.choosePlayer('Choose target opponent', opponents);
      const myPermanents = ctx.game.getBattlefield({ controller: 'you' }, ctx.controller);
      if (myPermanents.length === 0) return;
      const chosen = await ctx.choices.chooseUpToN('Choose a permanent to give away', myPermanents, 1, c => c.definition.name);
      if (chosen.length > 0) {
        // TODO: Properly transfer control to opponent
        // Count permanents you own that opponents control
        const ownedByOpponents = ctx.game.getBattlefield()
          .filter(c => c.owner === ctx.controller && c.controller !== ctx.controller).length + 1;
        const token = ctx.game.createToken(ctx.controller, {
          name: 'Ally',
          types: [CardType.CREATURE],
          subtypes: ['Ally'],
          power: 1,
          toughness: 1,
          colorIdentity: [ManaColor.WHITE],
        });
        // TODO: Put +1/+1 counters equal to ownedByOpponents on the token
      }
    },
    { optional: true, description: 'At the beginning of combat on your turn, you may have target opponent gain control of target permanent you control. When you do, create a 1/1 white Ally creature token. Put a +1/+1 counter on that token for each permanent you own that your opponents control.' },
  )
  .build();
