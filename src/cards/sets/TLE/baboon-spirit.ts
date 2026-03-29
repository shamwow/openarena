import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

export const BaboonSpirit = CardBuilder.create('Baboon Spirit')
  .cost('{2}{U}')
  .types(CardType.CREATURE)
  .subtypes('Monkey', 'Spirit')
  .stats(2, 4)
  .triggered(
    { on: 'enter-battlefield', filter: { subtypes: ['Spirit'], controller: 'you' } },
    async (ctx) => {
      if (ctx.event && 'objectId' in ctx.event && ctx.event.objectId === ctx.source.objectId) return;
      const enteredCard = ctx.event && 'objectId' in ctx.event ? ctx.game.getCard(ctx.event.objectId as string) : null;
      if (enteredCard && enteredCard.isToken) return;
      ctx.game.createToken(ctx.controller, {
        name: 'Spirit',
        types: [CardType.CREATURE],
        subtypes: ['Spirit'],
        power: 1,
        toughness: 1,
        colorIdentity: [],
        // TODO: This token can't block or be blocked by non-Spirit creatures
      });
    },
    { description: 'Whenever another nontoken Spirit you control enters, create a 1/1 colorless Spirit creature token.' }
  )
  .activated(
    { mana: parseManaCost('{3}{U}') },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.objectId !== ctx.source.objectId);
      if (creatures.length > 0) {
        const target = await ctx.choices.chooseOne('Exile another target creature you control', creatures, c => c.definition.name);
        ctx.game.exilePermanent(target.objectId);
        // TODO: Return it at beginning of next end step
      }
    },
    { description: '{3}{U}: Exile another target creature you control. Return it to the battlefield under its owner\'s control at the beginning of the next end step.' }
  )
  .build();
