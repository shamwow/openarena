import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import {
  createHasteAbilities,
  createHexproofAbilities,
  createShroudAbilities,
} from '../../../engine/AbilityPrimitives';

export const SolRing = CardBuilder.create('Sol Ring')
  .cost('{1}')
  .types(CardType.ARTIFACT)
  .activated(
    { tap: true },
    (ctx) => {
      ctx.game.addMana(ctx.controller, 'C', 2);
    },
    { isManaAbility: true, description: '{T}: Add {C}{C}.' }
  )
  .build();

export const ArcaneSignet = CardBuilder.create('Arcane Signet')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .tapForAnyColor()
  .build();

export const MindStone = CardBuilder.create('Mind Stone')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .activated(
    { tap: true },
    (ctx) => {
      ctx.game.addMana(ctx.controller, 'C', 1);
    },
    { isManaAbility: true, description: '{T}: Add {C}.' }
  )
  .activated(
    { mana: { generic: 1, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 }, tap: true, sacrifice: { self: true } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{1}, {T}, Sacrifice Mind Stone: Draw a card.' }
  )
  .build();

export const LightningGreaves = CardBuilder.create('Lightning Greaves')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .grantToAttached({ type: 'grant-abilities', abilities: createShroudAbilities(), filter: { self: true } })
  .grantToAttached({ type: 'grant-abilities', abilities: createHasteAbilities(), filter: { self: true } })
  .equip('{0}')
  .build();

export const SwiftfootBoots = CardBuilder.create('Swiftfoot Boots')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .grantToAttached({ type: 'grant-abilities', abilities: createHexproofAbilities(), filter: { self: true } })
  .grantToAttached({ type: 'grant-abilities', abilities: createHasteAbilities(), filter: { self: true } })
  .equip('{1}')
  .build();

export const CommandersSphere = CardBuilder.create("Commander's Sphere")
  .cost('{3}')
  .types(CardType.ARTIFACT)
  .tapForAnyColor()
  .activated(
    { sacrifice: { self: true } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: 'Sacrifice: Draw a card.' }
  )
  .build();

export const ThoughtVessel = CardBuilder.create('Thought Vessel')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .noMaxHandSize()
  .activated(
    { tap: true },
    (ctx) => {
      ctx.game.addMana(ctx.controller, 'C', 1);
    },
    { isManaAbility: true, description: '{T}: Add {C}.' }
  )
  .build();
