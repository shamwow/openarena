import { CardBuilder } from '../../CardBuilder';
import { CardType, Keyword } from '../../../engine/types';

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
  .oracleText('{T}: Add {C}{C}.')
  .build();

export const ArcaneSignet = CardBuilder.create('Arcane Signet')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .tapForAnyColor()
  .oracleText('{T}: Add one mana of any color in your commander\'s color identity.')
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
  .oracleText('{T}: Add {C}.\n{1}, {T}, Sacrifice Mind Stone: Draw a card.')
  .build();

export const LightningGreaves = CardBuilder.create('Lightning Greaves')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .keyword(Keyword.SHROUD)
  .keyword(Keyword.HASTE)
  .oracleText('Equipped creature has haste and shroud.\nEquip {0}')
  .build();

export const SwiftfootBoots = CardBuilder.create('Swiftfoot Boots')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .keyword(Keyword.HEXPROOF)
  .keyword(Keyword.HASTE)
  .oracleText('Equipped creature has hexproof and haste.\nEquip {1}')
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
  .oracleText('{T}: Add one mana of any color in your commander\'s color identity.\nSacrifice Commander\'s Sphere: Draw a card.')
  .build();

export const ThoughtVessel = CardBuilder.create('Thought Vessel')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .activated(
    { tap: true },
    (ctx) => {
      ctx.game.addMana(ctx.controller, 'C', 1);
    },
    { isManaAbility: true, description: '{T}: Add {C}.' }
  )
  .oracleText('You have no maximum hand size.\n{T}: Add {C}.')
  .build();
