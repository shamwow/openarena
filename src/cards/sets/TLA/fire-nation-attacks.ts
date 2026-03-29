import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';
import { createFirebendingTriggeredAbility } from '../../firebending';

export const FireNationAttacks = CardBuilder.create('Fire Nation Attacks')
  .cost('{4}{R}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    for (let i = 0; i < 2; i++) {
      ctx.game.createToken(ctx.controller, {
        name: 'Soldier',
        types: [CardType.CREATURE],
        subtypes: ['Soldier'],
        power: 2,
        toughness: 2,
        colorIdentity: [ManaColor.RED],
        abilities: [createFirebendingTriggeredAbility(1)],
      });
    }
  }, { description: 'Create two 2/2 red Soldier creature tokens with firebending 1.' })
  .flashback('{8}{R}')
  .build();
