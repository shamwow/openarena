import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createDoubleStrikeAbilities } from '../../../engine/AbilityPrimitives';

export const TwinBlades = CardBuilder.create('Twin Blades')
  .cost('{2}{R}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .flash()
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Attach Twin Blades to target creature you control', creatures, c => c.definition.name);
      ctx.game.attachPermanent(ctx.source.objectId, target.objectId);
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        target.objectId,
        target.zoneChangeCounter,
        createDoubleStrikeAbilities(),
      );
    }
  }, { description: 'When this Equipment enters, attach it to target creature you control. That creature gains double strike until end of turn.' })
  .grantToAttached({ type: 'pump', power: 1, toughness: 1, filter: { self: true } })
  .equip('{2}')
  .build();
