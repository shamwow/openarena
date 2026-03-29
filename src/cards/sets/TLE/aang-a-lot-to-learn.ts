import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createVigilanceAbilities } from '../../../engine/AbilityPrimitives';

export const AangALotToLearn = CardBuilder.create('Aang, A Lot to Learn')
  .cost('{2}{G/W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Avatar', 'Ally')
  .stats(3, 2)
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: createVigilanceAbilities(),
      filter: { self: true },
    },
    {
      condition: (game, source) => {
        const graveyard = game.zones[source.controller].GRAVEYARD;
        return graveyard.some(c => c.definition.subtypes.includes('Lesson'));
      },
      description: 'Aang has vigilance as long as there\'s a Lesson card in your graveyard.',
    },
  )
  .triggered(
    { on: 'dies', filter: { types: [CardType.CREATURE], controller: 'you' } },
    (ctx) => {
      // "another creature you control" — skip self
      // The trigger filter already ensures it's a creature we control that died
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever another creature you control dies, put a +1/+1 counter on Aang.' },
  )
  .build();
