import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const PhoenixFleetAirship = CardBuilder.create('Phoenix Fleet Airship')
  .cost('{2}{B}{B}')
  .types(CardType.ARTIFACT)
  .subtypes('Vehicle')
  .stats(4, 4)
  .flying()
  // TODO: "At the beginning of your end step, if you sacrificed a permanent this turn, create a token that's a copy of this Vehicle."
  // TODO: "As long as you control eight or more permanents named Phoenix Fleet Airship, this Vehicle is an artifact creature."
  .crew(1)
  .build();
