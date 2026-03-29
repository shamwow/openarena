import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const RedirectLightning = CardBuilder.create('Redirect Lightning')
  .cost('{R}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  // TODO: "As an additional cost, pay 5 life or pay {2}" — simplified to additional {2} cost
  .additionalCost('redirect-cost', '{2}', 'Pay 5 life or pay {2}')
  .spellEffect(async (ctx) => {
    // TODO: Change the target of target spell or ability with a single target
    // This requires stack manipulation which is complex to implement
  }, { description: 'Change the target of target spell or ability with a single target.' })
  .build();
