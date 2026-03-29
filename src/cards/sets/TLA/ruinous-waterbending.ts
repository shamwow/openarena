import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const RuinousWaterbending = CardBuilder.create('Ruinous Waterbending')
  .cost('{1}{B}{B}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .additionalCost('waterbend-cost', { waterbend: 4 }, 'Waterbend {4}', { optional: true })
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    const ids = creatures.map(c => c.objectId);
    ctx.game.grantPumpToObjectsUntilEndOfTurn(ids, -2, -2);
    // TODO: If additional cost was paid, whenever a creature dies this turn, you gain 1 life
    if (ctx.additionalCostsPaid?.includes('waterbend-cost')) {
      // Register delayed trigger for life gain on creature death this turn
    }
  }, { description: 'All creatures get -2/-2 until end of turn. If waterbend cost was paid, whenever a creature dies this turn, you gain 1 life.' })
  .build();
