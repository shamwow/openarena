import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const CreepingCrystalCoating = CardBuilder.create('Creeping Crystal Coating')
  .cost('{2}{G}')
  .types(CardType.ENCHANTMENT)
  .flash()
  .enchant({ what: 'creature', count: 1 })
  .grantToAttached({ type: 'pump', power: 0, toughness: 3, filter: { self: true } })
  .grantToAttached({
    type: 'grant-abilities',
    abilities: [{
      kind: 'triggered' as const,
      trigger: { on: 'attacks' as const, filter: { self: true } },
      effect: (ctx) => {
        ctx.game.createToken(ctx.controller, {
          name: 'Food',
          types: [CardType.ARTIFACT],
          subtypes: ['Food'],
          abilities: [{
            kind: 'activated' as const,
            cost: { mana: { generic: 2, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 }, tap: true, sacrifice: { self: true } },
            effect: (innerCtx) => {
              innerCtx.game.gainLife(innerCtx.controller, 3);
            },
            timing: 'instant' as const,
            isManaAbility: false,
            description: '{2}, {T}, Sacrifice this token: You gain 3 life.',
          }],
        });
      },
      optional: false,
      isManaAbility: false,
      description: 'Whenever this creature attacks, create a Food token.',
    }],
    filter: { self: true },
  })
  .build();
