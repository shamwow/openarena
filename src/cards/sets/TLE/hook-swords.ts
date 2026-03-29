import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';
import { createFirstStrikeAbilities } from '../../../engine/AbilityPrimitives';

export const HookSwords = CardBuilder.create('Hook Swords')
  .cost('{2}{R/W}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .etbEffect(async (ctx) => {
    const token = ctx.game.createToken(ctx.controller, {
      name: 'Ally',
      types: [CardType.CREATURE],
      subtypes: ['Ally'],
      power: 1,
      toughness: 1,
      colorIdentity: [ManaColor.WHITE],
    });
    ctx.game.attachPermanent(ctx.source.objectId, token.objectId);
  }, { description: 'When this Equipment enters, create a 1/1 white Ally creature token, then attach this Equipment to it.' })
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        if (!source.attachedTo) return;
        if (game.activePlayer !== source.controller) return;
        for (const pid of game.turnOrder) {
          for (const card of game.zones[pid].BATTLEFIELD) {
            if (card.objectId === source.attachedTo) {
              card.modifiedPower = (card.modifiedPower ?? card.definition.power ?? 0) + 1;
              card.modifiedToughness = (card.modifiedToughness ?? card.definition.toughness ?? 0) + 1;
              const abilities = card.modifiedAbilities ?? [...card.definition.abilities];
              abilities.push(...createFirstStrikeAbilities());
              card.modifiedAbilities = abilities;
              return;
            }
          }
        }
      },
    },
    { description: 'During your turn, equipped creature gets +1/+1 and has first strike.' },
  )
  .equip('{3}')
  .build();
