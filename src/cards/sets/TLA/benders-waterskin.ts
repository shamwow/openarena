import { CardBuilder } from '../../CardBuilder';
import { CardType, Step } from '../../../engine/types';

export const BendersWaterskin = CardBuilder.create("Bender's Waterskin")
  .cost('{3}')
  .types(CardType.ARTIFACT)
  .triggered(
    { on: 'step', step: Step.UNTAP },
    (ctx) => {
      ctx.game.untapPermanent(ctx.source.objectId);
    },
    {
      interveningIf: (game, source) => game.activePlayer !== source.controller,
      description: "Untap this artifact during each other player's untap step.",
    },
  )
  .tapForAnyColor()
  .build();
