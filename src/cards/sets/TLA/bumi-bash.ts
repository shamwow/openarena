import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BumiBash = CardBuilder.create('Bumi Bash')
  .cost('{3}{R}')
  .types(CardType.SORCERY)
  .modal([
    {
      label: 'Deal damage equal to the number of lands you control to target creature',
      effect: async (ctx) => {
        const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
        const damage = lands.length;
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Deal damage to target creature', creatures, c => c.definition.name);
          ctx.game.dealDamage(ctx.source.objectId, target.objectId, damage, false);
        }
      },
    },
    {
      label: 'Destroy target land creature or nonbasic land',
      effect: async (ctx) => {
        const targets = ctx.game.getBattlefield({ types: [CardType.LAND] }).filter(c => {
          const isLandCreature = c.definition.types.includes(CardType.CREATURE);
          const isNonbasic = !c.definition.supertypes.includes('Basic');
          return isLandCreature || isNonbasic;
        });
        if (targets.length > 0) {
          const target = await ctx.choices.chooseOne('Destroy target land creature or nonbasic land', targets, c => c.definition.name);
          ctx.game.destroyPermanent(target.objectId);
        }
      },
    },
  ], 1, 'Choose one')
  .build();
