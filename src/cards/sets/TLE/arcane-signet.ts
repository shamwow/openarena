import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ArcaneSignet = CardBuilder.create('Arcane Signet')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .tapForAnyColor()
  .build();
