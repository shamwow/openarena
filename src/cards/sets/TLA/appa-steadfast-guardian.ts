import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost, GameEventType } from '../../../engine/types';

export const AppaSteadfastGuardian = CardBuilder.create('Appa, Steadfast Guardian')
  .cost('{2}{W}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Bison', 'Ally')
  .stats(3, 4)
  .flash()
  .flying()
  .etbEffect(async (ctx) => {
    const permanents = ctx.game.getBattlefield({ controller: 'you' }, ctx.controller)
      .filter(c => c.objectId !== ctx.source.objectId && !c.definition.types.includes(CardType.LAND));
    if (permanents.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Airbend any number of other target nonland permanents you control', permanents, permanents.length, c => c.definition.name);
      for (const target of chosen) {
        ctx.game.airbendObject(target.objectId, { mana: parseManaCost('{2}') }, ctx.controller);
      }
    }
  }, { description: 'When Appa enters, airbend any number of other target nonland permanents you control.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.SPELL_CAST) return false;
        if (!('castMethod' in event)) return false;
        // TODO: Check if spell was cast from exile
        return false;
      },
    },
    async (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Ally',
        types: [CardType.CREATURE],
        subtypes: ['Ally'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
    },
    { description: 'Whenever you cast a spell from exile, create a 1/1 white Ally creature token.' }
  )
  .build();
