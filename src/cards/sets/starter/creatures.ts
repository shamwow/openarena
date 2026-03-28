import { CardBuilder } from '../../CardBuilder';
import { createFirebendingTriggeredAbility } from '../../firebending';
import { findCard, getEffectiveSubtypes, hasType } from '../../../engine/GameState';
import { CardType, GameEventType, ManaColor, Step, emptyManaCost } from '../../../engine/types';
import {
  createHexproofAbilities,
  createVigilanceAbilities,
} from '../../../engine/AbilityPrimitives';
import type { ActivatedAbilityDef } from '../../../engine/types';
import { Cost } from '../../../engine/costs';

// --- White Creatures ---

export const SerraAngel = CardBuilder.create('Serra Angel')
  .cost('{3}{W}{W}')
  .types(CardType.CREATURE)
  .subtypes('Angel')
  .stats(4, 4)
  .flying()
  .vigilance()
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
      return Cost.from(c.definition.cost).getManaValue() <= 3;
    });
    if (targets.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Return a permanent with mana value 3 or less from graveyard to battlefield', targets, 1, c => c.definition.name);
      for (const card of chosen) {
        ctx.game.moveCard(card.objectId, 'BATTLEFIELD', ctx.controller);
      }
    }
  }, { description: 'Whenever Sun Titan enters or attacks, return permanent with MV 3 or less from graveyard to battlefield.' })
  .build();

export const SoldiersOfTheWatch = CardBuilder.create('Soldiers of the Watch')
  .cost('{4}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(2, 4)
  .vigilance()
  .build();

// --- Blue Creatures ---

export const AirElemental = CardBuilder.create('Air Elemental')
  .cost('{3}{U}{U}')
  .types(CardType.CREATURE)
  .subtypes('Elemental')
  .stats(4, 4)
  .flying()
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
  .build();

export const GoblinGuide = CardBuilder.create('Goblin Guide')
  .cost('{R}')
  .types(CardType.CREATURE)
  .subtypes('Goblin', 'Scout')
  .stats(2, 2)
  .haste()
  .build();

export const FreedomFighterRecruit = CardBuilder.create('Freedom Fighter Recruit')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(0, 2)
  .staticAbility(
    {
      type: 'set-base-pt',
      filter: { self: true },
      layer: 'cda',
      power: (game, source) => game.turnOrder.reduce((count, playerId) => (
        count + game.zones[playerId].BATTLEFIELD.filter((card) => (
          !card.phasedOut &&
          card.controller === source.controller &&
          hasType(card, CardType.CREATURE)
        )).length
      ), 0),
      toughness: 2,
    },
    { description: "Freedom Fighter Recruit's power is equal to the number of creatures you control." },
  )
  .build();

export const LongshotRebelBowman = CardBuilder.create('Longshot, Rebel Bowman')
  .cost('{3}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(3, 3)
  .reach()
  .staticAbility(
    {
      type: 'cost-modification',
      costDelta: { generic: -1 },
      filter: {
        controller: 'you',
        custom: (card) => !hasType(card, CardType.CREATURE),
      },
    },
    { description: 'Noncreature spells you cast cost {1} less to cast.' },
  )
  .triggered(
    {
      on: 'custom',
      match: (event, source) =>
        event.type === GameEventType.SPELL_CAST
        && event.castBy === source.controller
        && !event.spellTypes.includes(CardType.CREATURE),
    },
    (ctx) => {
      for (const opponent of ctx.game.getOpponents(ctx.controller)) {
        ctx.game.dealDamage(ctx.source.objectId, opponent, 2, false);
      }
    },
    {
      description: 'Whenever you cast a noncreature spell, Longshot, Rebel Bowman deals 2 damage to each opponent.',
    },
  )
  .build();

function createAnyColorManaAbility(): ActivatedAbilityDef {
  return {
    kind: 'activated' as const,
    cost: { tap: true },
    effect: async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['W', 'U', 'B', 'R', 'G'] as const,
        (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    timing: 'instant' as const,
    isManaAbility: true,
    manaProduction: [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }],
    description: '{T}: Add one mana of any color.',
  };
}

export const GreatDivideGuide = CardBuilder.create('Great Divide Guide')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Scout', 'Ally')
  .stats(2, 3)
  .staticAbility(
    {
      type: 'grant-abilities',
      filter: {
        controller: 'you',
        custom: (card) => hasType(card, CardType.LAND)
          || (card.modifiedSubtypes ?? card.definition.subtypes).includes('Ally'),
      },
      abilities: [createAnyColorManaAbility()],
    },
    { description: "Each land and Ally you control has '{T}: Add one mana of any color.'" },
  )
  .build();

export const InfernalPlunge = CardBuilder.create('Inferno Titan')
  .id('inferno-titan')
  .cost('{4}{R}{R}')
  .types(CardType.CREATURE)
  .subtypes('Giant')
  .stats(6, 6)
  .etbEffect(async (ctx) => {
    // Deal 3 damage divided
    // Simplified: deal 3 to one target
    const validCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (validCreatures.length > 0) {
      const target = await ctx.choices.chooseOne('Deal 3 damage to', validCreatures, c => c.definition.name);
      ctx.game.dealDamage(ctx.source.objectId, target.objectId, 3, false);
    }
  }, { description: 'When Inferno Titan enters or attacks, deal 3 damage divided among targets.' })
  .build();

// --- Green Creatures ---

export const LlanowarElves = CardBuilder.create('Llanowar Elves')
  .cost('{G}')
  .types(CardType.CREATURE)
  .subtypes('Elf', 'Druid')
  .stats(1, 1)
  .tapForMana('G')
  .build();

export const BirdsOfParadise = CardBuilder.create('Birds of Paradise')
  .cost('{G}')
  .types(CardType.CREATURE)
  .subtypes('Bird')
  .stats(0, 1)
  .flying()
  .tapForAnyColor()
  .build();

export const ElvishMystic = CardBuilder.create('Elvish Mystic')
  .cost('{G}')
  .types(CardType.CREATURE)
  .subtypes('Elf', 'Druid')
  .stats(1, 1)
  .tapForMana('G')
  .build();

export const BadgermoleCub = CardBuilder.create('Badgermole Cub')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Badger', 'Mole')
  .stats(2, 2)
  .triggered(
    { on: 'tap-for-mana', filter: { types: [CardType.CREATURE], controller: 'you' } },
    (ctx) => {
      ctx.game.addMana(ctx.controller, 'G', 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['G'] }],
      description: 'Whenever you tap a creature for mana, add an additional {G}.',
    },
  )
  .build();

export const EarthKingdomGeneral = CardBuilder.create('Earth Kingdom General')
  .cost('{3}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(2, 2)
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller);
    if (lands.length === 0) return;

    const target = await ctx.choices.chooseOne(
      'Choose a land you control',
      lands,
      (card) => card.definition.name,
    );

    if (target && typeof target !== 'string') {
      ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
    }
  }, { description: 'When Earth Kingdom General enters, earthbend 2.' })
  .triggered(
    { on: 'counter-placed', counterType: '+1/+1', whose: 'yours', filter: { types: [CardType.CREATURE] } },
    async (ctx) => {
      if (ctx.event?.type !== GameEventType.COUNTER_ADDED) return;
      const gain = await ctx.choices.chooseYesNo(`Earth Kingdom General: Gain ${ctx.event.amount} life?`);
      if (gain) {
        ctx.game.gainLife(ctx.controller, ctx.event.amount);
      }
    },
    {
      oncePerTurn: true,
      optional: true,
      description: 'Whenever you put one or more +1/+1 counters on a creature, you may gain that much life. Do this only once each turn.',
    },
  )
  .build();

export const EarthbendingStudent = CardBuilder.create('Earthbending Student')
  .cost('{2}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(1, 3)
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller);
    if (lands.length === 0) return;

    const target = await ctx.choices.chooseOne(
      'Choose a land you control',
      lands,
      (card) => card.definition.name,
    );

    if (target && typeof target !== 'string') {
      ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
    }
  }, { description: 'When Earthbending Student enters, earthbend 2.' })
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: createVigilanceAbilities(),
      filter: {
        controller: 'you',
        custom: (card) => hasType(card, CardType.LAND) && hasType(card, CardType.CREATURE),
      },
    },
    { description: 'Land creatures you control have vigilance.' },
  )
  .build();

export const HaruHiddenTalent = CardBuilder.create('Haru, Hidden Talent')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Peasant', 'Ally')
  .stats(1, 1)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (event.controller !== source.controller) return false;
        if (
          event.objectId === source.objectId &&
          event.objectZoneChangeCounter === source.zoneChangeCounter
        ) {
          return false;
        }

        const enteringCard = findCard(game, event.objectId, event.objectZoneChangeCounter);
        return Boolean(enteringCard && getEffectiveSubtypes(enteringCard).includes('Ally'));
      },
    },
    async (ctx) => {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller);
      if (lands.length === 0) return;

      const target = await ctx.choices.chooseOne(
        'Choose a land you control',
        lands,
        (card) => card.definition.name,
      );

      if (target && typeof target !== 'string') {
        ctx.game.earthbendLand(target.objectId, 1, ctx.controller);
      }
    },
    {
      description: 'Whenever another Ally you control enters, earthbend 1.',
    },
  )
  .build();

export const AvatarKyoshiEarthbender = CardBuilder.create('Avatar Kyoshi, Earthbender')
  .cost('{5}{G}{G}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Avatar')
  .stats(6, 6)
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: createHexproofAbilities(),
      filter: { self: true },
    },
    {
      condition: (game, source) => game.activePlayer === source.controller,
      description: 'During your turn, Avatar Kyoshi has hexproof.',
    },
  )
  .triggered(
    {
      on: 'custom',
      match: (event, source) =>
        event.type === GameEventType.STEP_CHANGE &&
        event.step === Step.BEGINNING_OF_COMBAT &&
        event.activePlayer === source.controller,
    },
    async (ctx) => {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' });
      if (lands.length === 0) return;

      const target = await ctx.choices.chooseOne(
        'Choose a land you control',
        lands,
        (card) => card.definition.name,
      );

      if (target && typeof target !== 'string') {
        ctx.game.earthbendLand(target.objectId, 8, ctx.controller);
        ctx.game.untapPermanent(target.objectId);
      }
    },
    {
      description: 'At the beginning of combat on your turn, earthbend 8, then untap that land.',
    },
  )
  .build();

export const BumiEclecticEarthbender = CardBuilder.create('Bumi, Eclectic Earthbender')
  .cost('{3}{G}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(4, 4)
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller);
    if (lands.length === 0) return;

    const target = await ctx.choices.chooseOne(
      'Choose a land you control',
      lands,
      (card) => card.definition.name,
    );

    if (target && typeof target !== 'string') {
      ctx.game.earthbendLand(target.objectId, 1, ctx.controller);
    }
  }, { description: 'When Bumi enters, earthbend 1.' })
  .triggered(
    { on: 'attacks', filter: { self: true } },
    (ctx) => {
      const lands = ctx.game.getBattlefield({
        types: [CardType.LAND],
      }, ctx.controller).filter((card) => hasType(card, CardType.CREATURE));

      for (const land of lands) {
        ctx.game.addCounters(land.objectId, '+1/+1', 2, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
    },
    {
      description: 'Whenever Bumi attacks, put two +1/+1 counters on each land creature you control.',
    },
  )
  .build();

export const BumiUnleashed = CardBuilder.create('Bumi, Unleashed')
  .cost('{3}{R}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(5, 4)
  .trample()
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller);
    if (lands.length === 0) return;

    const target = await ctx.choices.chooseOne(
      'Choose a land you control',
      lands,
      (card) => card.definition.name,
    );

    if (target && typeof target !== 'string') {
      ctx.game.earthbendLand(target.objectId, 4, ctx.controller);
    }
  }, { description: 'When Bumi enters, earthbend 4.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source) =>
        event.type === GameEventType.DAMAGE_DEALT &&
        event.sourceId === source.objectId &&
        event.isCombatDamage &&
        typeof event.targetId === 'string' &&
        event.targetId.startsWith('player'),
    },
    (ctx) => {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller);
      for (const land of lands) {
        ctx.game.untapPermanent(land.objectId);
      }

      ctx.game.grantExtraCombat({
        attackRestriction: { types: [CardType.LAND] },
      });
    },
    {
      description: 'Whenever Bumi deals combat damage to a player, untap all lands you control. After this phase, there is an additional combat phase. Only land creatures can attack during that combat phase.',
    },
  )
  .build();

export const IrohDragonOfTheWest = CardBuilder.create('Iroh, Dragon of the West')
  .cost('{2}{R}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(4, 4)
  .haste()
  .triggered(
    {
      on: 'custom',
      match: (event, source) =>
        event.type === GameEventType.STEP_CHANGE &&
        event.step === Step.BEGINNING_OF_COMBAT &&
        event.activePlayer === source.controller,
    },
    (ctx) => {
      const eligibleCreatures = ctx.game
        .getBattlefield({ types: [CardType.CREATURE] }, ctx.controller)
        .filter((card) => Object.values(card.counters).some((count) => count > 0));

      for (const creature of eligibleCreatures) {
        ctx.game.grantAbilitiesUntilEndOfTurn(
          ctx.source.objectId,
          creature.objectId,
          creature.zoneChangeCounter,
          [createFirebendingTriggeredAbility(2)],
        );
      }
    },
    {
      description: 'At the beginning of combat on your turn, creatures you control with counters on them gain firebending 2 until end of turn.',
    },
  )
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const sourcePower = ctx.source.modifiedPower ?? ctx.source.definition.power ?? 0;
      const attackingCreatures = ctx.game
        .getBattlefield({ types: [CardType.CREATURE] }, ctx.controller)
        .filter((card) => (
          card.objectId !== ctx.source.objectId &&
          (ctx.state.combat?.attackers.has(card.objectId) ?? false) &&
          (card.modifiedPower ?? card.definition.power ?? 0) < sourcePower
        ));

      if (attackingCreatures.length === 0) return;

      const target = await ctx.choices.chooseOne(
        'Put a +1/+1 counter on target attacking creature with lesser power',
        attackingCreatures,
        (card) => card.definition.name,
      );

      ctx.game.addCounters(target.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Mentor' },
  )
  .build();

export const AnimalAttendant = CardBuilder.create('Animal Attendant')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Citizen')
  .stats(2, 2)
  .activated(
    { tap: true },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['W', 'U', 'B', 'R', 'G'] as const,
        (candidate) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[candidate]),
      );
      ctx.game.addMana(ctx.controller, color, 1, {
        trackedMana: {
          sourceId: ctx.source.objectId,
          effect: {
            kind: 'etb-counter-on-non-human-creature',
            counterType: '+1/+1',
            amount: 1,
          },
        },
      });
    },
    {
      timing: 'instant',
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }],
      trackedManaEffect: {
        kind: 'etb-counter-on-non-human-creature',
        counterType: '+1/+1',
        amount: 1,
      },
      description: '{T}: Add one mana of any color. If that mana is spent to cast a non-Human creature spell, that creature enters with an additional +1/+1 counter on it.',
    },
  )
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
  .build();
