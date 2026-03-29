import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const FoggySwampSpiritKeeper = CardBuilder.create('Foggy Swamp Spirit Keeper')
  .cost('{1}{U}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Druid', 'Ally')
  .stats(2, 4)
  .lifelink()
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.DREW_CARD) return false;
        if (event.player !== source.controller) return false;
        const drawCount = game.eventLog?.filter(
          e => e.type === GameEventType.DREW_CARD && e.player === source.controller && e.turn === game.turn,
        ).length ?? 0;
        return drawCount === 2;
      },
    },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Spirit',
        types: [CardType.CREATURE],
        subtypes: ['Spirit'],
        power: 1,
        toughness: 1,
        colorIdentity: [],
        abilities: [],
        // TODO: "This token can't block or be blocked by non-Spirit creatures."
      });
    },
    { description: 'Whenever you draw your second card each turn, create a 1/1 colorless Spirit creature token with "This token can\'t block or be blocked by non-Spirit creatures."' },
  )
  .build();
