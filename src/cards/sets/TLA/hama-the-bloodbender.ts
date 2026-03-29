import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const HamaTheBloodbender = CardBuilder.create('Hama, the Bloodbender')
  .cost('{2}{U/B}{U/B}{U/B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warlock')
  .stats(3, 3)
  .etbEffect(async (ctx) => {
    const opponents = ctx.game.getOpponents(ctx.controller);
    if (opponents.length === 0) return;
    const target = opponents.length === 1
      ? opponents[0]
      : await ctx.choices.choosePlayer('Choose target opponent', opponents);
    ctx.game.mill(target, 3);
    const graveyard = ctx.game.getGraveyard(target).filter(
      c => !c.definition.types.includes(CardType.CREATURE) && !c.definition.types.includes(CardType.LAND),
    );
    if (graveyard.length > 0) {
      const chosen = await ctx.choices.chooseUpToN(
        'Exile up to one noncreature, nonland card from that player\'s graveyard',
        graveyard,
        1,
        c => c.definition.name,
      );
      for (const card of chosen) {
        ctx.game.moveCard(card.objectId, 'EXILE');
        // TODO: Allow casting the exiled card during your turn by waterbending X
      }
    }
  }, { description: 'When Hama enters, target opponent mills three cards. Exile up to one noncreature, nonland card from that player\'s graveyard. For as long as you control Hama, you may cast the exiled card during your turn by waterbending {X} rather than paying its mana cost, where X is its mana value.' })
  .build();
