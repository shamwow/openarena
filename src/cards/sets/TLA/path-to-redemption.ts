import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

export const PathToRedemption = CardBuilder.create('Path to Redemption')
  .cost('{1}{W}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Aura')
  .enchant({ what: 'creature', count: 1 })
  .staticAbility(
    {
      type: 'custom',
      apply: (_game, source) => {
        // TODO: Enchanted creature can't attack or block
      },
    },
    { description: "Enchanted creature can't attack or block." },
  )
  .activated(
    { mana: parseManaCost('{5}'), sacrifice: { self: true } },
    (ctx) => {
      if (ctx.source.attachedTo) {
        ctx.game.exilePermanent(ctx.source.attachedTo);
      }
      ctx.game.createToken(ctx.controller, {
        name: 'Ally',
        types: [CardType.CREATURE],
        subtypes: ['Ally'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
    },
    {
      timing: 'sorcery',
      activateOnlyDuringYourTurn: true,
      description: '{5}, Sacrifice this Aura: Exile enchanted creature. Create a 1/1 white Ally creature token. Activate only during your turn.',
    },
  )
  .build();
