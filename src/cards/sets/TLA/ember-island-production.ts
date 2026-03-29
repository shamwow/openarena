import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const EmberIslandProduction = CardBuilder.create('Ember Island Production')
  .cost('{3}{U}{U}')
  .types(CardType.SORCERY)
  .modal([
    {
      label: "Create a token that's a copy of target creature you control, except it's not legendary and it's a 4/4 Hero in addition to its other types.",
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
        if (creatures.length === 0) return;
        const target = await ctx.choices.chooseOne('Choose a creature to copy', creatures, c => c.definition.name);
        // TODO: Create a modified copy token (not legendary, 4/4 Hero)
        ctx.game.createToken(ctx.controller, {
          name: target.definition.name,
          types: [...target.definition.types],
          subtypes: [...target.definition.subtypes, 'Hero'],
          power: 4,
          toughness: 4,
          colorIdentity: [...target.definition.colorIdentity],
          abilities: [...target.definition.abilities],
        });
      },
    },
    {
      label: "Create a token that's a copy of target creature an opponent controls, except it's not legendary and it's a 2/2 Coward in addition to its other types.",
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c => c.controller !== ctx.controller);
        if (creatures.length === 0) return;
        const target = await ctx.choices.chooseOne('Choose an opponent creature to copy', creatures, c => c.definition.name);
        ctx.game.createToken(ctx.controller, {
          name: target.definition.name,
          types: [...target.definition.types],
          subtypes: [...target.definition.subtypes, 'Coward'],
          power: 2,
          toughness: 2,
          colorIdentity: [...target.definition.colorIdentity],
          abilities: [...target.definition.abilities],
        });
      },
    },
  ], 1, 'Choose one —')
  .build();
