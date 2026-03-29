import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const BastionOfRemembrance = CardBuilder.create('Bastion of Remembrance')
  .cost('{2}{B}')
  .types(CardType.ENCHANTMENT)
  .etbEffect(async (ctx) => {
    ctx.game.createToken(ctx.controller, {
      name: 'Human Soldier',
      types: [CardType.CREATURE],
      subtypes: ['Human', 'Soldier'],
      power: 1,
      toughness: 1,
      colorIdentity: [ManaColor.WHITE],
    });
  }, { description: 'When this enchantment enters, create a 1/1 white Human Soldier creature token.' })
  .triggered(
    { on: 'dies', filter: { types: [CardType.CREATURE], controller: 'you' } },
    async (ctx) => {
      const opponents = ctx.game.getOpponents(ctx.controller);
      for (const opp of opponents) {
        ctx.game.loseLife(opp, 1);
      }
      ctx.game.gainLife(ctx.controller, 1);
    },
    { description: 'Whenever a creature you control dies, each opponent loses 1 life and you gain 1 life.' }
  )
  .build();
