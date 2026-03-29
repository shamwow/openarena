import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const KataraSeekingRevenge = CardBuilder.create('Katara, Seeking Revenge')
  .cost('{3}{U/B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 3)
  .waterbend(2)
  .etbEffect(async (ctx) => {
    ctx.game.drawCards(ctx.controller, 1);
    const wasPaid = ctx.costsPaid?.additionalCosts?.includes('waterbend') ?? false;
    if (!wasPaid) {
      const hand = ctx.game.getHand(ctx.controller);
      if (hand.length > 0) {
        const toDiscard = await ctx.choices.chooseOne('Discard a card', hand, c => c.definition.name);
        ctx.game.discardCard(ctx.controller, toDiscard.objectId);
      }
    }
  }, { description: 'When Katara enters, draw a card, then discard a card unless her additional cost was paid.' })
  // TODO: Waterbend {2} as additional cost to cast (not just generic waterbend)
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        const graveyard = game.zones[source.controller].GRAVEYARD;
        const lessonCount = graveyard.filter(c => c.definition.subtypes.includes('Lesson')).length;
        if (lessonCount > 0) {
          source.modifiedPower = (source.modifiedPower ?? source.definition.power ?? 0) + lessonCount;
          source.modifiedToughness = (source.modifiedToughness ?? source.definition.toughness ?? 0) + lessonCount;
        }
      },
    },
    { description: 'Katara gets +1/+1 for each Lesson card in your graveyard.' },
  )
  .build();
