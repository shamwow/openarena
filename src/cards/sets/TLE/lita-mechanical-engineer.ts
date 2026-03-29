import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { createFlyingAbilities } from '../../../engine/AbilityPrimitives';

export const LitaMechanicalEngineer = CardBuilder.create('Lita, Mechanical Engineer')
  .cost('{2}{W}')
  .types(CardType.ARTIFACT, CardType.CREATURE)
  .subtypes('Artificer')
  .supertypes('Legendary')
  .stats(3, 3)
  .vigilance()
  .triggered(
    { on: 'end-step', whose: 'yours' },
    (ctx) => {
      const artifactCreatures = ctx.game.getBattlefield(
        { types: [CardType.ARTIFACT as any, CardType.CREATURE as any], controller: 'you' },
        ctx.controller,
      ).filter(c => c.objectId !== ctx.source.objectId);
      for (const c of artifactCreatures) {
        ctx.game.untapPermanent(c.objectId);
      }
    },
    { description: 'At the beginning of your end step, untap each other artifact creature you control.' },
  )
  .activated(
    { mana: parseManaCost('{3}{W}'), tap: true },
    (ctx) => {
      // TODO: Token should have crew 3 ability — requires passing crew as ability definition
      ctx.game.createToken(ctx.controller, {
        name: 'Zeppelin',
        types: [CardType.ARTIFACT as any],
        subtypes: ['Vehicle'],
        power: 5,
        toughness: 5,
        colorIdentity: [],
        abilities: [...createFlyingAbilities()],
      });
    },
    { description: '{3}{W}, {T}: Create a 5/5 colorless Vehicle artifact token named Zeppelin with flying and crew 3.' },
  )
  .build();
