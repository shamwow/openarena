import { CardBuilder } from '../../CardBuilder';
import type { GameEngine, PlayerId } from '../../../engine/types';
import { CardType, ManaColor, GameEventType } from '../../../engine/types';
import { createFirebendingTriggeredAbility } from '../../firebending';

function createFirebendingSoldierToken(game: GameEngine, controller: PlayerId): void {
  game.createToken(controller, {
    name: 'Soldier',
    types: [CardType.CREATURE],
    subtypes: ['Soldier'],
    power: 2,
    toughness: 2,
    colorIdentity: [ManaColor.RED],
    abilities: [createFirebendingTriggeredAbility(1)],
  });
}

export const FireNationOccupation = CardBuilder.create('Fire Nation Occupation')
  .cost('{2}{B}')
  .types(CardType.ENCHANTMENT)
  .etbEffect((ctx) => {
    createFirebendingSoldierToken(ctx.game, ctx.controller);
  }, { description: 'When this enchantment enters, create a 2/2 red Soldier creature token with firebending 1.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) =>
        event.type === GameEventType.SPELL_CAST
        && event.castBy === source.controller
        && source.controller !== game.activePlayer,
    },
    (ctx) => {
      createFirebendingSoldierToken(ctx.game, ctx.controller);
    },
    { description: "Whenever you cast a spell during an opponent's turn, create a 2/2 red Soldier creature token with firebending 1." },
  )
  .build();
