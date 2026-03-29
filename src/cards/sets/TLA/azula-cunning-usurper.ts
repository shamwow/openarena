import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AzulaCunningUsurper = CardBuilder.create('Azula, Cunning Usurper')
  .cost('{2}{U}{B}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Rogue')
  .stats(4, 4)
  .firebending(2)
  .etbEffect(async (ctx) => {
    const opponents = ctx.game.getOpponents(ctx.controller);
    if (opponents.length > 0) {
      const opponent = await ctx.choices.choosePlayer('Choose target opponent', opponents);
      // Exile a nontoken creature they control
      const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'opponent' }, ctx.controller)
        .filter(c => !c.isToken && c.controller === opponent);
      if (oppCreatures.length > 0) {
        const creature = await ctx.choices.chooseOne('Exile a nontoken creature', oppCreatures, c => c.definition.name);
        ctx.game.exilePermanent(creature.objectId);
      }
      // Exile a nonland card from their graveyard
      const oppGraveyard = ctx.game.getGraveyard(opponent)
        .filter(c => !c.definition.types.includes(CardType.LAND));
      if (oppGraveyard.length > 0) {
        const card = await ctx.choices.chooseOne('Exile a nonland card from their graveyard', oppGraveyard, c => c.definition.name);
        ctx.game.moveCard(card.objectId, 'EXILE', opponent);
      }
    }
  }, { description: 'When Azula enters, target opponent exiles a nontoken creature they control, then they exile a nonland card from their graveyard.' })
  // TODO: During your turn, you may cast cards exiled with Azula as though they had flash
  .build();
