import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const SecretTunnel = CardBuilder.create('Secret Tunnel')
  .types(CardType.LAND)
  // TODO: "This land can't be blocked" — lands don't normally block or attack, this is a flavor oddity
  .tapForMana('C')
  .activated(
    { mana: parseManaCost('{4}'), tap: true },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      if (creatures.length < 2) return;
      // Choose two creatures that share a creature type
      const first = await ctx.choices.chooseOne('Choose first creature', creatures, c => c.definition.name);
      const matching = creatures.filter(c =>
        c.objectId !== first.objectId &&
        c.definition.subtypes.some(sub => first.definition.subtypes.includes(sub))
      );
      if (matching.length === 0) return;
      const second = await ctx.choices.chooseOne('Choose second creature sharing a creature type', matching, c => c.definition.name);
      // TODO: Grant "can't be blocked this turn" to both targets
    },
    { description: '{4}, {T}: Two target creatures you control that share a creature type can\'t be blocked this turn.' },
  )
  .build();
