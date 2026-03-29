import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const TeamAvatar = CardBuilder.create('Team Avatar')
  .cost('{2}{W}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'attacks-alone', filter: { types: [CardType.CREATURE], controller: 'you' } },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      const x = creatures.length;
      // TODO: Identify the attacking creature specifically
      const attackingCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you', tapped: true }, ctx.controller);
      for (const creature of attackingCreatures) {
        ctx.game.grantPumpToObjectsUntilEndOfTurn([creature.objectId], x, x);
      }
    },
    { description: 'Whenever a creature you control attacks alone, it gets +X/+X until end of turn, where X is the number of creatures you control.' },
  )
  .activated(
    { mana: parseManaCost('{2}{W}'), discard: { self: true } },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      const x = creatures.length;
      const targets = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
      if (targets.length === 0) return;
      const target = await ctx.choices.chooseOne('Choose target creature', targets, c => c.definition.name);
      ctx.game.dealDamage(ctx.source.objectId, target.objectId, x, false);
    },
    {
      activationZone: 'HAND',
      description: '{2}{W}, Discard this card: It deals damage equal to the number of creatures you control to target creature.',
    },
  )
  .build();
