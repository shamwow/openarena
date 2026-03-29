import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFlyingAbilities } from '../../../engine/AbilityPrimitives';

export const MechanicalGlider = CardBuilder.create('Mechanical Glider')
  .cost('{1}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Attach to target creature you control', creatures, c => c.definition.name);
      ctx.game.attachPermanent(ctx.source.objectId, target.objectId);
    }
  }, { description: 'When this Equipment enters, attach it to target creature you control.' })
  .grantToAttached({
    type: 'grant-abilities',
    abilities: createFlyingAbilities(),
    filter: { self: true },
  })
  .equip('{2}')
  .build();
