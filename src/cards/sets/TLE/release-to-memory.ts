import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ReleaseToMemory = CardBuilder.create('Release to Memory')
  .cost('{3}{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const opponents = ctx.game.getOpponents(ctx.controller);
    if (opponents.length === 0) return;
    const target = await ctx.choices.choosePlayer('Choose target opponent', opponents);
    const graveyard = ctx.game.getGraveyard(target);
    let creatureCount = 0;
    for (const card of [...graveyard]) {
      if (card.definition.types.includes(CardType.CREATURE)) {
        creatureCount++;
      }
      ctx.game.moveCard(card.objectId, 'EXILE', target);
    }
    for (let i = 0; i < creatureCount; i++) {
      ctx.game.createToken(ctx.controller, {
        name: 'Spirit',
        types: [CardType.CREATURE],
        subtypes: ['Spirit'],
        power: 1,
        toughness: 1,
        colorIdentity: [],
      });
    }
  }, { description: "Exile target opponent's graveyard. For each creature card exiled this way, create a 1/1 colorless Spirit creature token." })
  .build();
