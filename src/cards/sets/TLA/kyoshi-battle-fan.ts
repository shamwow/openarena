import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const KyoshiBattleFan = CardBuilder.create('Kyoshi Battle Fan')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .etbEffect(async (ctx) => {
    const token = ctx.game.createToken(ctx.controller, {
      name: 'Ally',
      types: [CardType.CREATURE],
      subtypes: ['Ally'],
      power: 1,
      toughness: 1,
      colorIdentity: [ManaColor.WHITE],
    });
    ctx.game.attachPermanent(ctx.source.objectId, token.objectId);
  }, { description: 'When this Equipment enters, create a 1/1 white Ally creature token, then attach this Equipment to it.' })
  .grantToAttached({ type: 'pump', power: 1, toughness: 0, filter: { self: true } })
  .equip('{2}')
  .build();
