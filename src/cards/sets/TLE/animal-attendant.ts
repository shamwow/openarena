import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AnimalAttendant = CardBuilder.create('Animal Attendant')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Citizen')
  .stats(2, 2)
  .tapForAnyColor()
  // TODO: If mana is spent on a non-Human creature spell, that creature enters with an additional +1/+1 counter
  .build();
