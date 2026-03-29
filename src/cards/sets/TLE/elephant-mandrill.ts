import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ElephantMandrill = CardBuilder.create('Elephant-Mandrill')
  .cost('{2}{G}')
  .types(CardType.CREATURE)
  .subtypes('Elephant', 'Monkey')
  .stats(3, 2)
  .reach()
  .etbEffect((ctx) => {
    // Each player creates a Food token
    const allPlayers = [ctx.controller, ...ctx.game.getOpponents(ctx.controller)];
    for (const player of allPlayers) {
      ctx.game.createToken(player, {
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
    }
  }, { description: 'When this creature enters, each player creates a Food token.' })
  .triggered(
    { on: 'step', step: 'BEGINNING_OF_COMBAT', whose: 'yours' },
    (ctx) => {
      let artifactCount = 0;
      for (const opp of ctx.game.getOpponents(ctx.controller)) {
        artifactCount += ctx.game.getBattlefield({ types: [CardType.ARTIFACT] }, opp).length;
      }
      if (artifactCount > 0) {
        ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], artifactCount, artifactCount);
      }
    },
    { description: 'At the beginning of combat on your turn, this creature gets +1/+1 until end of turn for each artifact your opponents control.' }
  )
  .build();
