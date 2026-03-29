import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { hasType } from '../../../engine/GameState';

export const FreedomFighterRecruit = CardBuilder.create('Freedom Fighter Recruit')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(0, 2)
  .staticAbility(
    {
      type: 'set-base-pt',
      filter: { self: true },
      layer: 'cda',
      power: (game, source) => game.turnOrder.reduce((count, playerId) => (
        count + game.zones[playerId].BATTLEFIELD.filter((card) => (
          !card.phasedOut &&
          card.controller === source.controller &&
          hasType(card, CardType.CREATURE)
        )).length
      ), 0),
      toughness: 2,
    },
    { description: "Freedom Fighter Recruit's power is equal to the number of creatures you control." },
  )
  .build();
