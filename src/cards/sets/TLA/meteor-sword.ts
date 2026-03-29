import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const MeteorSword = CardBuilder.create('Meteor Sword')
  .cost('{7}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .etbEffect(async (ctx) => {
    const permanents = ctx.game.getBattlefield();
    if (permanents.length > 0) {
      const target = await ctx.choices.chooseOne('Choose target permanent to destroy', permanents, c => c.definition.name);
      ctx.game.destroyPermanent(target.objectId);
    }
  }, { description: 'When this Equipment enters, destroy target permanent.' })
  .grantToAttached({ type: 'pump', power: 3, toughness: 3, filter: { self: true } })
  .equip('{3}')
  .build();
