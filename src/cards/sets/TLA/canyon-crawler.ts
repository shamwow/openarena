import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CanyonCrawler = CardBuilder.create('Canyon Crawler')
  .cost('{4}{B}{B}')
  .types(CardType.CREATURE)
  .subtypes('Spider', 'Beast')
  .stats(6, 6)
  .deathtouch()
  .etbEffect((ctx) => {
    ctx.game.createPredefinedToken(ctx.controller, 'Food');
  }, { description: 'When this creature enters, create a Food token.' })
  .landcycling('{2}', 'Swamp')
  .build();
