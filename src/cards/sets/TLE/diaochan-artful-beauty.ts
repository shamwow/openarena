import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DiaochanArtfulBeauty = CardBuilder.create('Diaochan, Artful Beauty')
  .cost('{3}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Advisor')
  .stats(1, 1)
  .activated(
    { tap: true },
    async (ctx) => {
      // Destroy target creature of your choice
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c => c.objectId !== ctx.source.objectId);
      if (creatures.length > 0) {
        const yourChoice = await ctx.choices.chooseOne('Destroy target creature of your choice', creatures, c => c.definition.name);
        ctx.game.destroyPermanent(yourChoice.objectId);
      }
      // Then destroy target creature of an opponent's choice
      // TODO: The opponent should choose, not the controller
      const remainingCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c => c.objectId !== ctx.source.objectId);
      if (remainingCreatures.length > 0) {
        const oppChoice = await ctx.choices.chooseOne("Destroy target creature of an opponent's choice", remainingCreatures, c => c.definition.name);
        ctx.game.destroyPermanent(oppChoice.objectId);
      }
    },
    { timing: 'sorcery', activateOnlyDuringYourTurn: true, description: "{T}: Destroy target creature of your choice, then destroy target creature of an opponent's choice. Activate only during your turn, before attackers are declared." }
  )
  .build();
