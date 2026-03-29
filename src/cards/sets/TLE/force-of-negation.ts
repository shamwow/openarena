import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ForceOfNegation = CardBuilder.create('Force of Negation')
  .cost('{1}{U}{U}')
  .types(CardType.INSTANT)
  // TODO: If it's not your turn, you may exile a blue card from your hand rather than pay mana cost
  .spellEffect(async (ctx) => {
    // TODO: Counter target noncreature spell. If countered this way, exile it.
  }, { description: 'Counter target noncreature spell. If that spell is countered this way, exile it instead of putting it into its owner\'s graveyard.' })
  .build();
