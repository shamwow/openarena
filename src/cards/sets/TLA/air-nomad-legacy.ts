import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFlyingAbilities } from '../../../engine/AbilityPrimitives';

export const AirNomadLegacy = CardBuilder.create('Air Nomad Legacy')
  .cost('{W}{U}')
  .types(CardType.ENCHANTMENT)
  .etbEffect(async (ctx) => {
    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: 'When this enchantment enters, create a Clue token.' })
  .staticAbility(
    {
      type: 'pump',
      power: 1,
      toughness: 1,
      filter: {
        controller: 'you',
        types: [CardType.CREATURE],
        custom: (card) => {
          const abilities = card.modifiedAbilities ?? card.definition.abilities;
          return abilities.some(a =>
            a.kind === 'static' && 'effect' in a && a.effect &&
            'type' in a.effect && a.effect.type === 'block-rule' &&
            'evasion' in a.effect && a.effect.evasion === 'requires-flying-or-reach'
          );
        },
      },
    },
    { description: 'Creatures you control with flying get +1/+1.' }
  )
  .build();
