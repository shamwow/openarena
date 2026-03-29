import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const PurplePentapus = CardBuilder.create('Purple Pentapus')
  .cost('{B}')
  .types(CardType.CREATURE)
  .subtypes('Octopus', 'Starfish')
  .stats(1, 1)
  .etbEffect(async (ctx) => {
    await ctx.game.surveil(ctx.controller, 1);
  }, { description: 'When this creature enters, surveil 1.' })
  // TODO: "{2}{B}, Tap an untapped creature you control: Return this card from your graveyard to the battlefield tapped."
  // Requires graveyard-zone activated ability with tap-another-creature cost
  .build();
