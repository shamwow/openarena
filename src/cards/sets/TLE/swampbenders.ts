import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Swampbenders = CardBuilder.create('Swampbenders')
  .cost('{4}{G}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Druid', 'Ally')
  .stats(0, 0)
  // Power and toughness equal to number of Swamps on the battlefield
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        const swamps = game.turnOrder.flatMap(pid =>
          game.zones[pid].BATTLEFIELD.filter(c =>
            c.definition.subtypes.includes('Swamp')
          )
        );
        source.modifiedPower = swamps.length;
        source.modifiedToughness = swamps.length;
      },
    },
    { description: "Swampbenders's power and toughness are each equal to the number of Swamps on the battlefield." },
  )
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        // Lands you control are Swamps in addition to their other types
        const lands = game.zones[source.controller].BATTLEFIELD.filter(c =>
          c.definition.types.includes(CardType.LAND as any)
        );
        for (const land of lands) {
          if (!land.definition.subtypes.includes('Swamp')) {
            const subs = land.modifiedSubtypes ?? [...land.definition.subtypes];
            if (!subs.includes('Swamp')) {
              subs.push('Swamp');
            }
            land.modifiedSubtypes = subs;
          }
        }
      },
    },
    { description: 'Lands you control are Swamps in addition to their other types.' },
  )
  .build();
