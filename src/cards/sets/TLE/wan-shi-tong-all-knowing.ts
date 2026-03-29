import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const WanShiTongAllKnowing = CardBuilder.create('Wan Shi Tong, All-Knowing')
  .cost('{3}{U}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Bird', 'Spirit')
  .stats(4, 4)
  .flying()
  .etbEffect(async (ctx) => {
    const permanents = ctx.game.getBattlefield().filter(c =>
      !c.definition.types.includes(CardType.LAND) && c.objectId !== ctx.source.objectId,
    );
    if (permanents.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a nonland permanent to put into its owner\'s library', permanents, c => c.definition.name);
      // TODO: Put second from top or on bottom (owner's choice)
      ctx.game.moveCard(target.objectId, 'LIBRARY', target.owner);
    }
  }, { description: 'When Wan Shi Tong enters, target nonland permanent\'s owner puts it into their library second from the top or on the bottom.' })
  .triggered(
    {
      on: 'custom',
      match: (event, _source, _game) => {
        // Whenever one or more cards are put into a library from anywhere
        if (event.type === GameEventType.ZONE_CHANGE) {
          const zc = event as typeof event & { toZone?: string };
          return zc.toZone === 'LIBRARY';
        }
        return false;
      },
    },
    (ctx) => {
      // Create two 1/1 colorless Spirit tokens
      for (let i = 0; i < 2; i++) {
        ctx.game.createToken(ctx.controller, {
          name: 'Spirit',
          types: [CardType.CREATURE],
          subtypes: ['Spirit'],
          power: 1,
          toughness: 1,
          colorIdentity: [],
          // TODO: "This token can't block or be blocked by non-Spirit creatures."
        });
      }
    },
    { oncePerTurn: true, description: 'Whenever one or more cards are put into a library from anywhere, create two 1/1 colorless Spirit creature tokens.' },
  )
  .build();
