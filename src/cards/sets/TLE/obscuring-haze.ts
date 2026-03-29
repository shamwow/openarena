import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ObscuringHaze = CardBuilder.create('Obscuring Haze')
  .cost('{2}{G}')
  .types(CardType.INSTANT)
  // TODO: If you control a commander, you may cast this spell without paying its mana cost
  .spellEffect((ctx) => {
    // TODO: Prevent all damage that would be dealt this turn by creatures your opponents control
    // This requires a replacement effect for damage prevention
  }, { description: 'Prevent all damage that would be dealt this turn by creatures your opponents control.' })
  .build();
