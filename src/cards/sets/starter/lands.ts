import { CardBuilder } from '../../CardBuilder';
import { createFirebendingTriggeredAbility } from '../../firebending';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

// --- Basic Lands ---

export const Plains = CardBuilder.create('Plains')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Plains')
  .colors(ManaColor.WHITE)
  .tapForMana('W')
  .build();

export const Island = CardBuilder.create('Island')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Island')
  .colors(ManaColor.BLUE)
  .tapForMana('U')
  .build();

export const Swamp = CardBuilder.create('Swamp')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Swamp')
  .colors(ManaColor.BLACK)
  .tapForMana('B')
  .build();

export const Mountain = CardBuilder.create('Mountain')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Mountain')
  .colors(ManaColor.RED)
  .tapForMana('R')
  .build();

export const Forest = CardBuilder.create('Forest')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Forest')
  .colors(ManaColor.GREEN)
  .tapForMana('G')
  .build();

export const BaSingSe = CardBuilder.create('Ba Sing Se')
  .types(CardType.LAND)
  .entersTappedUnlessYouControl({
    types: [CardType.LAND],
    supertypes: ['Basic'],
  })
  .tapForMana('G')
  .activated(
    { mana: parseManaCost('{2}{G}'), tap: true },
    (ctx) => {
      const target = ctx.targets[0];
      if (target && typeof target !== 'string') {
        ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
      }
    },
    {
      timing: 'sorcery',
      targets: [{
        what: 'permanent',
        filter: { types: [CardType.LAND], controller: 'you' },
        count: 1,
      }],
      description: '{2}{G}, {T}: Earthbend 2.',
    },
  )
  .build();

// --- Nonbasic Lands ---

export const CommandTower = CardBuilder.create('Command Tower')
  .types(CardType.LAND)
  .tapForAnyColor()
  .build();

export const ExoticOrchard = CardBuilder.create('Exotic Orchard')
  .types(CardType.LAND)
  .tapForAnyColor()
  .build();

export const ReliquaryTower = CardBuilder.create('Reliquary Tower')
  .types(CardType.LAND)
  .tapForMana('C')
  .noMaxHandSize()
  .build();

export const FireNationPalace = CardBuilder.create('Fire Nation Palace')
  .types(CardType.LAND)
  .entersTappedUnlessYouControl({
    types: [CardType.LAND],
    supertypes: ['Basic'],
  })
  .tapForMana('R')
  .activated(
    { mana: parseManaCost('{1}{R}'), tap: true },
    (ctx) => {
      const target = ctx.targets[0];
      if (target && typeof target !== 'string') {
        ctx.game.grantAbilitiesUntilEndOfTurn(
          ctx.source.objectId,
          target.objectId,
          target.zoneChangeCounter,
          [createFirebendingTriggeredAbility(4)],
        );
      }
    },
    {
      targets: [{
        what: 'creature',
        filter: { controller: 'you' },
        count: 1,
      }],
      description: '{1}{R}, {T}: Target creature you control gains firebending 4 until end of turn.',
    },
  )
  .build();

export const OmashuCity = CardBuilder.create('Omashu City')
  .types(CardType.LAND)
  .entersTapped()
  .activated(
    { tap: true },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['R', 'G'] as const,
        (candidate) => ({ R: 'Red', G: 'Green' }[candidate]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['R', 'G'] }],
      description: '{T}: Add {R} or {G}.',
    },
  )
  .activated(
    { mana: parseManaCost('{4}'), tap: true, sacrifice: { self: true } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{4}, {T}, Sacrifice this land: Draw a card.' },
  )
  .build();
