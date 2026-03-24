import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

// --- White Creatures ---

export const SerraAngel = CardBuilder.create('Serra Angel')
  .cost('{3}{W}{W}')
  .types(CardType.CREATURE)
  .subtypes('Angel')
  .stats(4, 4)
  .flying()
  .vigilance()
  .oracleText('Flying, vigilance')
  .build();

export const SunTitan = CardBuilder.create('Sun Titan')
  .cost('{4}{W}{W}')
  .types(CardType.CREATURE)
  .subtypes('Giant')
  .stats(6, 6)
  .vigilance()
  .etbEffect(async (ctx) => {
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const targets = graveyard.filter(c => {
      const cmc = c.definition.manaCost.generic + c.definition.manaCost.W +
        c.definition.manaCost.U + c.definition.manaCost.B +
        c.definition.manaCost.R + c.definition.manaCost.G;
      return cmc <= 3;
    });
    if (targets.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Return a permanent with mana value 3 or less from graveyard to battlefield', targets, 1, c => c.definition.name);
      for (const card of chosen) {
        ctx.game.moveCard(card.objectId, 'BATTLEFIELD', ctx.controller);
      }
    }
  }, { description: 'Whenever Sun Titan enters or attacks, return permanent with MV 3 or less from graveyard to battlefield.' })
  .oracleText('Vigilance\nWhenever Sun Titan enters the battlefield or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.')
  .build();

export const SoldiersOfTheWatch = CardBuilder.create('Soldiers of the Watch')
  .cost('{4}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(2, 4)
  .vigilance()
  .oracleText('Vigilance')
  .build();

// --- Blue Creatures ---

export const AirElemental = CardBuilder.create('Air Elemental')
  .cost('{3}{U}{U}')
  .types(CardType.CREATURE)
  .subtypes('Elemental')
  .stats(4, 4)
  .flying()
  .oracleText('Flying')
  .build();

export const Mulldrifter = CardBuilder.create('Mulldrifter')
  .cost('{4}{U}')
  .types(CardType.CREATURE)
  .subtypes('Elemental')
  .stats(2, 2)
  .flying()
  .etbEffect((ctx) => {
    ctx.game.drawCards(ctx.controller, 2);
  }, { description: 'When Mulldrifter enters the battlefield, draw two cards.' })
  .oracleText('Flying\nWhen Mulldrifter enters the battlefield, draw two cards.')
  .build();

// --- Black Creatures ---

export const GraveTitan = CardBuilder.create('Grave Titan')
  .cost('{4}{B}{B}')
  .types(CardType.CREATURE)
  .subtypes('Giant')
  .stats(6, 6)
  .deathtouch()
  .etbEffect((ctx) => {
    ctx.game.createToken(ctx.controller, {
      name: 'Zombie',
      types: [CardType.CREATURE],
      subtypes: ['Zombie'],
      power: 2,
      toughness: 2,
      colorIdentity: [ManaColor.BLACK],
    });
    ctx.game.createToken(ctx.controller, {
      name: 'Zombie',
      types: [CardType.CREATURE],
      subtypes: ['Zombie'],
      power: 2,
      toughness: 2,
      colorIdentity: [ManaColor.BLACK],
    });
  }, { description: 'When Grave Titan enters the battlefield or attacks, create two 2/2 black Zombie creature tokens.' })
  .oracleText('Deathtouch\nWhenever Grave Titan enters the battlefield or attacks, create two 2/2 black Zombie creature tokens.')
  .build();

export const BloodArtist = CardBuilder.create('Blood Artist')
  .cost('{1}{B}')
  .types(CardType.CREATURE)
  .subtypes('Vampire')
  .stats(0, 1)
  .triggered(
    { on: 'dies', filter: { types: [CardType.CREATURE] } },
    async (ctx) => {
      const opponents = ctx.game.getOpponents(ctx.controller);
      const target = await ctx.choices.choosePlayer('Choose a player to lose 1 life', opponents);
      ctx.game.loseLife(target, 1);
      ctx.game.gainLife(ctx.controller, 1);
    },
    { description: 'Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.' }
  )
  .oracleText('Whenever Blood Artist or another creature dies, target opponent loses 1 life and you gain 1 life.')
  .build();

// --- Red Creatures ---

export const ShivanDragon = CardBuilder.create('Shivan Dragon')
  .cost('{4}{R}{R}')
  .types(CardType.CREATURE)
  .subtypes('Dragon')
  .stats(5, 5)
  .flying()
  .activated(
    { mana: { generic: 0, W: 0, U: 0, B: 0, R: 1, G: 0, C: 0, X: 0 } },
    () => {
      // +1/+0 until end of turn (handled via continuous effects in full impl)
    },
    { description: '{R}: Shivan Dragon gets +1/+0 until end of turn.' }
  )
  .oracleText('Flying\n{R}: Shivan Dragon gets +1/+0 until end of turn.')
  .build();

export const GoblinGuide = CardBuilder.create('Goblin Guide')
  .cost('{R}')
  .types(CardType.CREATURE)
  .subtypes('Goblin', 'Scout')
  .stats(2, 2)
  .haste()
  .oracleText('Haste')
  .build();

export const InfernalPlunge = CardBuilder.create('Inferno Titan')
  .id('inferno-titan')
  .cost('{4}{R}{R}')
  .types(CardType.CREATURE)
  .subtypes('Giant')
  .stats(6, 6)
  .etbEffect(async (ctx) => {
    // Simplified: deal 3 to one target
    const validCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (validCreatures.length > 0) {
      const target = await ctx.choices.chooseOne('Deal 3 damage to', validCreatures, c => c.definition.name);
      ctx.game.dealDamage(ctx.source.objectId, target.objectId, 3, false);
    }
  }, { description: 'When Inferno Titan enters or attacks, deal 3 damage divided among targets.' })
  .oracleText('Whenever Inferno Titan enters the battlefield or attacks, it deals 3 damage divided as you choose among one, two, or three targets.')
  .build();

// --- Green Creatures ---

export const LlanowarElves = CardBuilder.create('Llanowar Elves')
  .cost('{G}')
  .types(CardType.CREATURE)
  .subtypes('Elf', 'Druid')
  .stats(1, 1)
  .tapForMana('G')
  .oracleText('{T}: Add {G}.')
  .build();

export const BirdsOfParadise = CardBuilder.create('Birds of Paradise')
  .cost('{G}')
  .types(CardType.CREATURE)
  .subtypes('Bird')
  .stats(0, 1)
  .flying()
  .tapForAnyColor()
  .oracleText('Flying\n{T}: Add one mana of any color.')
  .build();

export const ElvishMystic = CardBuilder.create('Elvish Mystic')
  .cost('{G}')
  .types(CardType.CREATURE)
  .subtypes('Elf', 'Druid')
  .stats(1, 1)
  .tapForMana('G')
  .oracleText('{T}: Add {G}.')
  .build();

export const SakuraTribeElder = CardBuilder.create('Sakura-Tribe Elder')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Snake', 'Shaman')
  .stats(1, 1)
  .activated(
    { sacrifice: { self: true } },
    async (ctx) => {
      // Search library for a basic land and put it onto the battlefield tapped
      const library = ctx.game.getLibrary(ctx.controller);
      const basics = library.filter(c =>
        c.definition.types.includes(CardType.LAND) && c.definition.supertypes.includes('Basic')
      );
      if (basics.length > 0) {
        const chosen = await ctx.choices.chooseOne('Choose a basic land', basics, c => c.definition.name);
        ctx.game.moveCard(chosen.objectId, 'BATTLEFIELD', ctx.controller);
        // Tap the land
        const card = ctx.game.getCard(chosen.objectId);
        if (card) card.tapped = true;
      }
      ctx.game.shuffleLibrary(ctx.controller);
    },
    { description: 'Sacrifice: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.' }
  )
  .oracleText('Sacrifice Sakura-Tribe Elder: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle your library.')
  .build();

export const BeastWithin = CardBuilder.create('Acidic Slime')
  .id('acidic-slime')
  .cost('{3}{G}{G}')
  .types(CardType.CREATURE)
  .subtypes('Ooze')
  .stats(2, 2)
  .deathtouch()
  .etbEffect(async (ctx) => {
    const targets = ctx.game.getBattlefield().filter(c =>
      c.definition.types.includes(CardType.ARTIFACT) ||
      c.definition.types.includes(CardType.ENCHANTMENT) ||
      c.definition.types.includes(CardType.LAND)
    );
    if (targets.length > 0) {
      const chosen = await ctx.choices.chooseOne('Destroy target artifact, enchantment, or land', targets, c => c.definition.name);
      ctx.game.destroyPermanent(chosen.objectId);
    }
  }, { description: 'When Acidic Slime enters, destroy target artifact, enchantment, or land.' })
  .oracleText('Deathtouch\nWhen Acidic Slime enters the battlefield, destroy target artifact, enchantment, or land.')
  .build();

// --- Multicolor / Colorless ---

export const SolemnSimulacrum = CardBuilder.create('Solemn Simulacrum')
  .cost('{4}')
  .types(CardType.CREATURE, CardType.ARTIFACT)
  .subtypes('Golem')
  .stats(2, 2)
  .etbEffect(async (ctx) => {
    const library = ctx.game.getLibrary(ctx.controller);
    const basics = library.filter(c =>
      c.definition.types.includes(CardType.LAND) && c.definition.supertypes.includes('Basic')
    );
    if (basics.length > 0) {
      const chosen = await ctx.choices.chooseOne('Choose a basic land', basics, c => c.definition.name);
      ctx.game.moveCard(chosen.objectId, 'BATTLEFIELD', ctx.controller);
      const card = ctx.game.getCard(chosen.objectId);
      if (card) card.tapped = true;
    }
    ctx.game.shuffleLibrary(ctx.controller);
  }, { description: 'When Solemn Simulacrum enters, search for a basic land tapped.' })
  .diesEffect((ctx) => {
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'When Solemn Simulacrum dies, draw a card.' })
  .oracleText('When Solemn Simulacrum enters the battlefield, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\nWhen Solemn Simulacrum dies, you may draw a card.')
  .build();
