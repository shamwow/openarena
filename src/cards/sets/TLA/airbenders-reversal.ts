import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const AirbendersReversal = CardBuilder.create("Airbender's Reversal")
  .cost('{1}{W}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .modal([
    {
      label: 'Destroy target attacking creature',
      effect: async (ctx) => {
        const attackers = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c => c.tapped);
        if (attackers.length > 0) {
          const target = await ctx.choices.chooseOne('Destroy target attacking creature', attackers, c => c.definition.name);
          ctx.game.destroyPermanent(target.objectId);
        }
      },
    },
    {
      label: 'Airbend target creature you control',
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Airbend target creature you control', creatures, c => c.definition.name);
          ctx.game.airbendObject(target.objectId, { mana: parseManaCost('{2}') }, ctx.controller);
        }
      },
    },
  ], 1, 'Choose one')
  .build();
