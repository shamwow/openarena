import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { createFlyingAbilities } from '../../../engine/AbilityPrimitives';

export const AppaLoyalSkyBison = CardBuilder.create('Appa, Loyal Sky Bison')
  .cost('{4}{W}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Bison', 'Ally')
  .stats(4, 4)
  .flying()
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type === 'ENTERS_BATTLEFIELD' && 'objectId' in event && event.objectId === source.objectId) return true;
        if (event.type === 'ATTACKS' && 'attackerId' in event && event.attackerId === source.objectId) return true;
        return false;
      },
    },
    async (ctx) => {
      const mode = await ctx.choices.chooseOne('Choose one', ['Grant flying', 'Airbend'] as const, m => m);
      if (mode === 'Grant flying') {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Target creature you control gains flying', creatures, c => c.definition.name);
          ctx.game.grantAbilitiesUntilEndOfTurn(ctx.source.objectId, target.objectId, target.zoneChangeCounter, createFlyingAbilities());
        }
      } else {
        const permanents = ctx.game.getBattlefield({ controller: 'you' }, ctx.controller)
          .filter(c => c.objectId !== ctx.source.objectId && !c.definition.types.includes(CardType.LAND));
        if (permanents.length > 0) {
          const target = await ctx.choices.chooseOne('Airbend another target nonland permanent you control', permanents, c => c.definition.name);
          ctx.game.airbendObject(target.objectId, { mana: parseManaCost('{2}') }, ctx.controller);
        }
      }
    },
    { description: 'Whenever Appa enters or attacks, choose one: Target creature you control gains flying until end of turn; or airbend another target nonland permanent you control.' }
  )
  .build();
