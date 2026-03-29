import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const MirrorwingDragon = CardBuilder.create('Mirrorwing Dragon')
  .cost('{3}{R}{R}')
  .types(CardType.CREATURE)
  .subtypes('Dragon')
  .stats(4, 5)
  .flying()
  // TODO: Whenever a player casts an instant or sorcery spell that targets only this creature,
  // that player copies that spell for each other creature they control that the spell could target.
  // Each copy targets a different one of those creatures.
  .build();
