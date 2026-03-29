import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const HeartbeatOfSpring = CardBuilder.create('Heartbeat of Spring')
  .cost('{2}{G}')
  .types(CardType.ENCHANTMENT)
  // TODO: Whenever a player taps a land for mana, that player adds one mana of any type that land produced
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Double mana from lands
      },
    },
    { description: 'Whenever a player taps a land for mana, that player adds one mana of any type that land produced.' },
  )
  .build();
