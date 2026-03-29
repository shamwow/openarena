import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const MerchantOfManyHats = CardBuilder.create('Merchant of Many Hats')
  .cost('{1}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Peasant', 'Ally')
  .stats(2, 2)
  .activated(
    { mana: parseManaCost('{2}{B}') },
    (ctx) => {
      ctx.game.moveCard(ctx.source.objectId, 'HAND', ctx.source.owner);
    },
    {
      activationZone: 'GRAVEYARD',
      description: '{2}{B}: Return this card from your graveyard to your hand.',
    },
  )
  .build();
