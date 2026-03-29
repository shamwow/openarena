import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BendersWaterskin = CardBuilder.create("Bender's Waterskin")
  .cost('{3}')
  .types(CardType.ARTIFACT)
  // TODO: Untap this artifact during each other player's untap step
  .tapForAnyColor()
  .build();
