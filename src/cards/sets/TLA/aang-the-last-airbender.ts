import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { createLifelinkAbilities } from '../../../engine/AbilityPrimitives';

export const AangTheLastAirbender = CardBuilder.create('Aang, the Last Airbender')
  .cost('{3}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Avatar', 'Ally')
  .stats(3, 2)
  .flying()
  .etbEffect(async (ctx) => {
    // Airbend up to one other target nonland permanent
    const targets = ctx.game.getBattlefield().filter(
      c => c.objectId !== ctx.source.objectId && !c.definition.types.includes(CardType.LAND),
    );
    if (targets.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Airbend up to one other target nonland permanent', targets, 1, c => c.definition.name);
      for (const target of chosen) {
        ctx.game.airbendObject(target.objectId, { mana: parseManaCost('{2}') }, ctx.controller);
      }
    }
  }, { description: 'When Aang enters, airbend up to one other target nonland permanent.' })
  .triggered(
    { on: 'cast-spell', filter: { subtypes: ['Lesson'], controller: 'you' } },
    (ctx) => {
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        ctx.source.objectId,
        ctx.source.zoneChangeCounter,
        createLifelinkAbilities(),
      );
    },
    { description: 'Whenever you cast a Lesson spell, Aang gains lifelink until end of turn.' },
  )
  .build();
