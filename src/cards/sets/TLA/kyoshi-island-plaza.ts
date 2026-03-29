import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard, getEffectiveSubtypes } from '../../../engine/GameState';

export const KyoshiIslandPlaza = CardBuilder.create('Kyoshi Island Plaza')
  .cost('{3}{G}')
  .types(CardType.ENCHANTMENT)
  .supertypes('Legendary')
  .subtypes('Shrine')
  .etbEffect(async (ctx) => {
    const shrines = ctx.game.getBattlefield({ subtypes: ['Shrine'], controller: 'you' }, ctx.controller);
    const x = shrines.length;
    if (x > 0) {
      await ctx.game.searchLibraryWithOptions({
        player: ctx.controller,
        filter: { types: [CardType.LAND], supertypes: ['Basic'] },
        destination: 'BATTLEFIELD',
        count: x,
        tapped: true,
      });
    }
  }, { description: 'When Kyoshi Island Plaza enters, search your library for up to X basic land cards, where X is the number of Shrines you control. Put those cards onto the battlefield tapped, then shuffle.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (event.controller !== source.controller) return false;
        if (event.objectId === source.objectId) return false;
        const enteringCard = findCard(game, event.objectId, event.objectZoneChangeCounter);
        return Boolean(enteringCard && getEffectiveSubtypes(enteringCard).includes('Shrine'));
      },
    },
    async (ctx) => {
      await ctx.game.searchLibraryWithOptions({
        player: ctx.controller,
        filter: { types: [CardType.LAND], supertypes: ['Basic'] },
        destination: 'BATTLEFIELD',
        count: 1,
        tapped: true,
      });
    },
    { description: 'Whenever another Shrine you control enters, search your library for a basic land card, put it onto the battlefield tapped, then shuffle.' },
  )
  .build();
