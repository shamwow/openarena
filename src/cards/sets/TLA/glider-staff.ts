import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { createFlyingAbilities } from '../../../engine/AbilityPrimitives';

export const GliderStaff = CardBuilder.create('Glider Staff')
  .cost('{2}{W}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .etbEffect(async (ctx) => {
    // Airbend up to one target creature
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Airbend up to one target creature', creatures, 1, c => c.definition.name);
      for (const target of chosen) {
        ctx.game.airbendObject(target.objectId, { mana: parseManaCost('{2}') }, ctx.controller);
      }
    }
  }, { description: 'When this Equipment enters, airbend up to one target creature.' })
  .grantToAttached({
    type: 'pump',
    power: 1,
    toughness: 1,
    filter: { self: true },
  })
  .grantToAttached({
    type: 'grant-abilities',
    abilities: createFlyingAbilities(),
    filter: { self: true },
  })
  .equip('{2}')
  .build();
