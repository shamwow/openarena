import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SwampsnareTrap = CardBuilder.create('Swampsnare Trap')
  .cost('{2}{B}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Aura')
  // TODO: Costs {1} less if targeting a creature with flying
  .enchant({ what: 'creature', count: 1 })
  .grantToAttached({ type: 'pump', power: -5, toughness: -3, filter: { self: true } })
  .build();
