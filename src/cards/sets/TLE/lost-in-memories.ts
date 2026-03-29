import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const LostInMemories = CardBuilder.create('Lost in Memories')
  .cost('{1}{R}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Aura')
  .flash()
  .enchant({ what: 'creature', filter: { controller: 'you' }, count: 1 })
  .grantToAttached({ type: 'pump', power: 1, toughness: 1, filter: { self: true } })
  // TODO: Grant triggered ability: "Whenever this creature deals combat damage to a player, target instant or sorcery card in your graveyard gains flashback until end of turn. The flashback cost is equal to its mana cost."
  .build();
