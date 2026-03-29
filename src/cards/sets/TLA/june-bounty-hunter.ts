import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType, parseManaCost } from '../../../engine/types';

export const JuneBountyHunter = CardBuilder.create('June, Bounty Hunter')
  .cost('{1}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Mercenary')
  .stats(2, 2)
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        const drawCount = game.eventLog?.filter(
          e => e.type === GameEventType.DREW_CARD && e.player === source.controller && e.turn === game.turn,
        ).length ?? 0;
        if (drawCount >= 2) {
          // TODO: Grant unblockable to June
        }
      },
    },
    { description: "June can't be blocked as long as you've drawn two or more cards this turn." },
  )
  .activated(
    { mana: parseManaCost('{1}'), sacrifice: { filter: { types: [CardType.CREATURE], controller: 'you', self: false }, count: 1 } },
    (ctx) => {
      ctx.game.createPredefinedToken(ctx.controller, 'Clue');
    },
    {
      timing: 'instant',
      activateOnlyDuringYourTurn: true,
      description: '{1}, Sacrifice another creature: Create a Clue token. Activate only during your turn.',
    },
  )
  .build();
