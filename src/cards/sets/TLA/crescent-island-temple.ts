import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';
import { createProwessAbilities } from '../../../engine/AbilityPrimitives';

export const CrescentIslandTemple = CardBuilder.create('Crescent Island Temple')
  .cost('{3}{R}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Shrine')
  .supertypes('Legendary')
  .etbEffect(async (ctx) => {
    const shrineCount = ctx.game.getBattlefield({ subtypes: ['Shrine'], controller: 'you' }, ctx.controller).length;
    for (let i = 0; i < shrineCount; i++) {
      ctx.game.createToken(ctx.controller, {
        name: 'Monk',
        types: [CardType.CREATURE as any],
        subtypes: ['Monk'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.RED],
        abilities: createProwessAbilities(),
      });
    }
  }, { description: 'When Crescent Island Temple enters, for each Shrine you control, create a 1/1 red Monk creature token with prowess.' })
  .triggered(
    {
      on: 'enter-battlefield',
      filter: { subtypes: ['Shrine'], controller: 'you' },
    },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Monk',
        types: [CardType.CREATURE as any],
        subtypes: ['Monk'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.RED],
        abilities: createProwessAbilities(),
      });
    },
    {
      interveningIf: (_game, source, event) => event.objectId !== source.objectId,
      description: 'Whenever another Shrine you control enters, create a 1/1 red Monk creature token with prowess.',
    },
  )
  .build();
