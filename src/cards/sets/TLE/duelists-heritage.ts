import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createDoubleStrikeAbilities } from '../../../engine/AbilityPrimitives';

export const DuelistsHeritage = CardBuilder.create("Duelist's Heritage")
  .cost('{2}{W}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'attacks' },
    async (ctx) => {
      const attackingCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c => c.tapped);
      if (attackingCreatures.length === 0) return;
      const grant = await ctx.choices.chooseYesNo('Grant double strike to an attacking creature?');
      if (grant) {
        const target = await ctx.choices.chooseOne('Choose an attacking creature to gain double strike', attackingCreatures, c => c.definition.name);
        ctx.game.grantAbilitiesUntilEndOfTurn(
          target.objectId,
          ctx.source.objectId,
          ctx.source.zoneChangeCounter,
          createDoubleStrikeAbilities(),
        );
      }
    },
    { optional: true, description: 'Whenever one or more creatures attack, you may have target attacking creature gain double strike until end of turn.' }
  )
  .build();
