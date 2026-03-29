import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { getEffectiveSubtypes } from '../../../engine/GameState';

export const EarthenAlly = CardBuilder.create('Earthen Ally')
  .cost('{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(0, 2)
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        const allies = game.zones[source.controller].BATTLEFIELD.filter(
          (c: any) => getEffectiveSubtypes(c).includes('Ally')
        );
        const colors = new Set<string>();
        for (const ally of allies) {
          for (const color of ally.definition.colorIdentity) {
            colors.add(color);
          }
        }
        source.modifiedPower = (source.definition.power ?? 0) + colors.size;
      },
    },
    { description: 'This creature gets +1/+0 for each color among Allies you control.' }
  )
  .activated(
    { mana: parseManaCost('{2}{W}{U}{B}{R}{G}') },
    async (ctx) => {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend 5', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, 5, ctx.controller);
      }
    },
    { description: '{2}{W}{U}{B}{R}{G}: Earthbend 5.' }
  )
  .build();
