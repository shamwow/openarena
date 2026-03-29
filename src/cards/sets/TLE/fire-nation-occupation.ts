import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, GameEventType } from '../../../engine/types';

export const FireNationOccupation = CardBuilder.create('Fire Nation Occupation')
  .cost('{2}{B}')
  .types(CardType.ENCHANTMENT)
  .etbEffect((ctx) => {
    ctx.game.createToken(ctx.controller, {
      name: 'Soldier',
      types: [CardType.CREATURE],
      subtypes: ['Soldier'],
      power: 2,
      toughness: 2,
      colorIdentity: [ManaColor.RED],
      abilities: [],
    });
    // TODO: Token should have firebending 1
  }, { description: 'When this enchantment enters, create a 2/2 red Soldier creature token with firebending 1.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source) =>
        event.type === GameEventType.SPELL_CAST
        && event.castBy === source.controller
        && source.controller !== event.activePlayer,
    },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Soldier',
        types: [CardType.CREATURE],
        subtypes: ['Soldier'],
        power: 2,
        toughness: 2,
        colorIdentity: [ManaColor.RED],
        abilities: [],
      });
      // TODO: Token should have firebending 1
    },
    { description: "Whenever you cast a spell during an opponent's turn, create a 2/2 red Soldier creature token with firebending 1." },
  )
  .build();
