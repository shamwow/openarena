import { CardBuilder } from '../../CardBuilder';
import {
  findCard,
  getEffectiveSupertypes,
  hasType,
  markExileInsteadOfDyingThisTurn,
} from '../../../engine/GameState';
import { CardType, GameEventType, ManaColor, parseManaCost } from '../../../engine/types';

// --- White Spells ---

export const SwordsToPlowshares = CardBuilder.create('Swords to Plowshares')
  .cost('{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Exile target creature', creatures, c => `${c.definition.name} (${c.controller})`);
      const power = target.modifiedPower ?? target.definition.power ?? 0;
      const owner = target.controller;
      ctx.game.exilePermanent(target.objectId);
      ctx.game.gainLife(owner, power);
    }
  }, { description: 'Exile target creature. Its controller gains life equal to its power.' })
  .oracleText('Exile target creature. Its controller gains life equal to its power.')
  .build();

export const PathToExile = CardBuilder.create('Path to Exile')
  .cost('{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Exile target creature', creatures, c => `${c.definition.name} (${c.controller})`);
      const owner = target.controller;
      ctx.game.exilePermanent(target.objectId);
      // Search for basic land
      const library = ctx.game.getLibrary(owner);
      const basics = library.filter(c =>
        c.definition.types.includes(CardType.LAND) && c.definition.supertypes.includes('Basic')
      );
      if (basics.length > 0) {
        const chosen = await ctx.choices.chooseUpToN('Search for a basic land', basics, 1, c => c.definition.name);
        for (const land of chosen) {
          ctx.game.moveCard(land.objectId, 'BATTLEFIELD', owner);
        }
      }
      ctx.game.shuffleLibrary(owner);
    }
  }, { description: 'Exile target creature. Its controller may search for a basic land tapped.' })
  .oracleText('Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle their library.')
  .build();

export const WrathOfGod = CardBuilder.create('Wrath of God')
  .cost('{2}{W}{W}')
  .types(CardType.SORCERY)
  .spellEffect((ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    for (const creature of creatures) {
      ctx.game.destroyPermanent(creature.objectId);
    }
  }, { description: 'Destroy all creatures. They can\'t be regenerated.' })
  .oracleText('Destroy all creatures. They can\'t be regenerated.')
  .build();

export const Disenchant = CardBuilder.create('Disenchant')
  .cost('{1}{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const targets = ctx.game.getBattlefield().filter(c =>
      c.definition.types.includes(CardType.ARTIFACT) ||
      c.definition.types.includes(CardType.ENCHANTMENT)
    );
    if (targets.length > 0) {
      const target = await ctx.choices.chooseOne('Destroy target artifact or enchantment', targets, c => c.definition.name);
      ctx.game.destroyPermanent(target.objectId);
    }
  }, { description: 'Destroy target artifact or enchantment.' })
  .oracleText('Destroy target artifact or enchantment.')
  .build();

// --- Blue Spells ---

export const Counterspell = CardBuilder.create('Counterspell')
  .cost('{U}{U}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const stackSpells = ctx.state.stack.filter(e => e.entryType === 'SPELL');
    if (stackSpells.length > 0) {
      const target = await ctx.choices.chooseOne(
        'Counter target spell',
        stackSpells,
        e => e.cardInstance?.definition.name ?? 'Unknown spell'
      );
      ctx.game.counterSpell(target.id);
    }
  }, { description: 'Counter target spell.' })
  .oracleText('Counter target spell.')
  .build();

export const BrainstormCard = CardBuilder.create('Brainstorm')
  .cost('{U}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    ctx.game.drawCards(ctx.controller, 3);
    const hand = ctx.game.getHand(ctx.controller);
    if (hand.length >= 2) {
      const chosen = await ctx.choices.chooseN('Put two cards on top of your library', hand, 2, c => c.definition.name);
      for (const card of chosen) {
        ctx.game.moveCard(card.objectId, 'LIBRARY', ctx.controller);
      }
    }
  }, { description: 'Draw three cards, then put two cards from your hand on top of your library.' })
  .oracleText('Draw three cards, then put two cards from your hand on top of your library in any order.')
  .build();

export const CatharticReunion = CardBuilder.create('Cathartic Reunion')
  .cost('{1}{R}')
  .types(CardType.SORCERY)
  .additionalCost(
    'discard-two-cards',
    { discard: 2 },
    'Discard two cards',
  )
  .spellEffect((ctx) => {
    ctx.game.drawCards(ctx.controller, 3);
  }, { description: 'As an additional cost to cast this spell, discard two cards. Draw three cards.' })
  .oracleText('As an additional cost to cast this spell, discard two cards.\nDraw three cards.')
  .build();

export const Ponder = CardBuilder.create('Ponder')
  .cost('{U}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    // Look at top 3, reorder or shuffle, then draw
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'Look at the top three cards of your library. Put them back or shuffle. Draw a card.' })
  .oracleText('Look at the top three cards of your library, then put them back in any order. You may shuffle your library.\nDraw a card.')
  .build();

export const Explore = CardBuilder.create('Explore')
  .cost('{1}{G}')
  .types(CardType.SORCERY)
  .colors(ManaColor.GREEN)
  .spellEffect((ctx) => {
    ctx.state.players[ctx.controller].landPlaysAvailable += 1;
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'You may play an additional land this turn. Draw a card.' })
  .oracleText('You may play an additional land this turn.\nDraw a card.')
  .build();

// --- Black Spells ---

export const DoomBlade = CardBuilder.create('Doom Blade')
  .cost('{1}{B}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c =>
      !c.definition.colorIdentity.includes(ManaColor.BLACK)
    );
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Destroy target nonblack creature', creatures, c => c.definition.name);
      ctx.game.destroyPermanent(target.objectId);
    }
  }, { description: 'Destroy target nonblack creature.' })
  .oracleText('Destroy target nonblack creature.')
  .build();

export const SignInBlood = CardBuilder.create('Sign in Blood')
  .cost('{B}{B}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const players = ctx.game.getActivePlayers();
    const target = await ctx.choices.choosePlayer('Target player draws two cards and loses 2 life', players);
    ctx.game.drawCards(target, 2);
    ctx.game.loseLife(target, 2);
  }, { description: 'Target player draws two cards and loses 2 life.' })
  .oracleText('Target player draws two cards and loses 2 life.')
  .build();

export const Damnation = CardBuilder.create('Damnation')
  .cost('{2}{B}{B}')
  .types(CardType.SORCERY)
  .spellEffect((ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    for (const creature of creatures) {
      ctx.game.destroyPermanent(creature.objectId);
    }
  }, { description: 'Destroy all creatures. They can\'t be regenerated.' })
  .oracleText('Destroy all creatures. They can\'t be regenerated.')
  .build();

// --- Red Spells ---

export const LightningBolt = CardBuilder.create('Lightning Bolt')
  .cost('{R}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    // Can target any creature or player
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    const players = ctx.game.getActivePlayers();
    const options = [
      ...creatures.map(c => ({ label: `${c.definition.name} (creature)`, value: c.objectId as string })),
      ...players.map(p => ({ label: `Player: ${ctx.state.players[p].name}`, value: p as string })),
    ];
    if (options.length > 0) {
      const choice = await ctx.choices.chooseOne('Deal 3 damage to', options, o => o.label);
      ctx.game.dealDamage(ctx.source.objectId, choice.value, 3, false);
    }
  }, { description: 'Lightning Bolt deals 3 damage to any target.' })
  .oracleText('Lightning Bolt deals 3 damage to any target.')
  .build();

export const Chaos_Warp = CardBuilder.create('Chaos Warp')
  .cost('{2}{R}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const permanents = ctx.game.getBattlefield();
    if (permanents.length > 0) {
      const target = await ctx.choices.chooseOne('Shuffle target permanent into its owner\'s library', permanents, c => c.definition.name);
      const owner = target.owner;
      ctx.game.moveCard(target.objectId, 'LIBRARY', owner);
      ctx.game.shuffleLibrary(owner);
    }
  }, { description: 'Owner shuffles target permanent into library, then reveals top card.' })
  .oracleText('The owner of target permanent shuffles it into their library, then reveals the top card of their library. If it\'s a permanent card, they put it onto the battlefield.')
  .build();

export const CombustionTechnique = CardBuilder.create('Combustion Technique')
  .cost('{1}{R}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const target = ctx.targets[0];
    if (!target || typeof target === 'string') {
      return;
    }

    markExileInsteadOfDyingThisTurn(ctx.state, target.objectId, target.zoneChangeCounter);
    target.exileInsteadOfDyingThisTurnZoneChangeCounter = target.zoneChangeCounter;

    const lessonsInGraveyard = ctx.game.getGraveyard(ctx.controller).filter((card) =>
      card.definition.subtypes.includes('Lesson')
    ).length;
    const damage = 2 + lessonsInGraveyard;
    ctx.game.dealDamage(ctx.source.objectId, target.objectId, damage, false);
  }, {
    targets: [{
      what: 'creature',
      count: 1,
    }],
    description: 'Combustion Technique deals damage equal to 2 plus the number of Lesson cards in your graveyard to target creature.',
  })
  .oracleText('Combustion Technique deals damage equal to 2 plus the number of Lesson cards in your graveyard to target creature. If that creature would die this turn, exile it instead.')
  .build();

export const BumiBash = CardBuilder.create('Bumi Bash')
  .cost('{3}{R}')
  .types(CardType.SORCERY)
  .modal([
    {
      label: 'Bumi Bash deals damage equal to the number of lands you control to target creature.',
      targets: [
        {
          what: 'creature',
          count: 1,
        },
      ],
      effect: (ctx) => {
        const target = ctx.targets[0];
        if (!target || typeof target === 'string') {
          return;
        }

        const landCount = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller).length;
        ctx.game.dealDamage(ctx.source.objectId, target.objectId, landCount, false);
      },
    },
    {
      label: 'Destroy target land creature or nonbasic land.',
      targets: [
        {
          what: 'permanent',
          count: 1,
          filter: {
            types: [CardType.LAND],
            custom: (card) => {
              return hasType(card, CardType.CREATURE) || !getEffectiveSupertypes(card).includes('Basic');
            },
          },
        },
      ],
      effect: (ctx) => {
        const target = ctx.targets[0];
        if (!target || typeof target === 'string') {
          return;
        }

        ctx.game.destroyPermanent(target.objectId);
      },
    },
  ], 1, 'Choose one')
  .oracleText('Choose one —\n• Bumi Bash deals damage equal to the number of lands you control to target creature.\n• Destroy target land creature or nonbasic land.')
  .build();

export const FieryConfluence = CardBuilder.create('Fiery Confluence')
  .cost('{2}{R}{R}')
  .types(CardType.SORCERY)
  .modal([
    {
      label: 'Fiery Confluence deals 1 damage to each creature.',
      effect: (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
        for (const creature of creatures) {
          ctx.game.dealDamage(ctx.source.objectId, creature.objectId, 1, false);
        }
      },
    },
    {
      label: 'Fiery Confluence deals 2 damage to each opponent.',
      effect: (ctx) => {
        for (const opponent of ctx.game.getOpponents(ctx.controller)) {
          ctx.game.dealDamage(ctx.source.objectId, opponent, 2, false);
        }
      },
    },
    {
      label: 'Destroy target artifact.',
      targets: [{
        what: 'permanent',
        count: 1,
        filter: { types: [CardType.ARTIFACT] },
      }],
      effect: (ctx) => {
        const target = ctx.targets[0];
        if (!target || typeof target === 'string') {
          return;
        }

        ctx.game.destroyPermanent(target.objectId);
      },
    },
  ], 3, 'Choose three', { allowRepeatedModes: true })
  .oracleText('Choose three. You may choose the same mode more than once.\n• Fiery Confluence deals 1 damage to each creature.\n• Fiery Confluence deals 2 damage to each opponent.\n• Destroy target artifact.')
  .build();

export const BlasphemousAct = CardBuilder.create('Blasphemous Act')
  .cost('{8}{R}')
  .types(CardType.SORCERY)
  .affinity({ types: [CardType.CREATURE] }, 'This spell costs {1} less to cast for each creature on the battlefield.')
  .spellEffect((ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    for (const creature of creatures) {
      ctx.game.dealDamage(ctx.source.objectId, creature.objectId, 13, false);
    }
  }, { description: 'Blasphemous Act deals 13 damage to each creature.' })
  .oracleText('This spell costs {1} less to cast for each creature on the battlefield.\nBlasphemous Act deals 13 damage to each creature.')
  .build();

// --- Green Spells ---

export const Cultivate = CardBuilder.create('Cultivate')
  .cost('{2}{G}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const library = ctx.game.getLibrary(ctx.controller);
    const basics = library.filter(c =>
      c.definition.types.includes(CardType.LAND) && c.definition.supertypes.includes('Basic')
    );
    if (basics.length >= 2) {
      const chosen = await ctx.choices.chooseN('Choose two basic lands', basics, Math.min(2, basics.length), c => c.definition.name);
      if (chosen.length >= 1) {
        ctx.game.moveCard(chosen[0].objectId, 'BATTLEFIELD', ctx.controller);
        const card = ctx.game.getCard(chosen[0].objectId);
        if (card) card.tapped = true;
      }
      if (chosen.length >= 2) {
        ctx.game.moveCard(chosen[1].objectId, 'HAND', ctx.controller);
      }
    }
    ctx.game.shuffleLibrary(ctx.controller);
  }, { description: 'Search for two basic lands, one to battlefield tapped, one to hand.' })
  .oracleText('Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.')
  .build();

export const CycleOfRenewal = CardBuilder.create('Cycle of Renewal')
  .cost('{2}{G}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    await ctx.game.sacrificePermanents(
      ctx.controller,
      { types: [CardType.LAND], controller: 'you' },
      1,
      'Choose a land to sacrifice',
    );

    const selected = await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: { types: [CardType.LAND], supertypes: ['Basic'] },
      destination: 'BATTLEFIELD',
      count: 2,
      optional: true,
      shuffle: true,
    });

    for (const card of selected) {
      const instance = ctx.game.getCard(card.objectId);
      if (instance) {
        instance.tapped = true;
      }
    }
  }, { description: 'Sacrifice a land. Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle.' })
  .oracleText('Sacrifice a land. Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle your library.')
  .build();

export const KodamasReach = CardBuilder.create("Kodama's Reach")
  .cost('{2}{G}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const library = ctx.game.getLibrary(ctx.controller);
    const basics = library.filter(c =>
      c.definition.types.includes(CardType.LAND) && c.definition.supertypes.includes('Basic')
    );
    if (basics.length >= 2) {
      const chosen = await ctx.choices.chooseN('Choose two basic lands', basics, Math.min(2, basics.length), c => c.definition.name);
      if (chosen.length >= 1) {
        ctx.game.moveCard(chosen[0].objectId, 'BATTLEFIELD', ctx.controller);
        const card = ctx.game.getCard(chosen[0].objectId);
        if (card) card.tapped = true;
      }
      if (chosen.length >= 2) {
        ctx.game.moveCard(chosen[1].objectId, 'HAND', ctx.controller);
      }
    }
    ctx.game.shuffleLibrary(ctx.controller);
  }, { description: 'Search for two basic lands, one to battlefield tapped, one to hand.' })
  .oracleText('Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.')
  .build();

export const CrackedEarthTechnique = CardBuilder.create('Cracked Earth Technique')
  .cost('{4}{G}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const earthbend = async () => {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller);
      if (lands.length === 0) return;

      const target = await ctx.choices.chooseOne(
        'Choose a land you control',
        lands,
        (card) => card.definition.name,
      );

      if (target && typeof target !== 'string') {
        ctx.game.earthbendLand(target.objectId, 3, ctx.controller);
      }
    };

    await earthbend();
    await earthbend();
    ctx.game.gainLife(ctx.controller, 3);
  }, { description: 'Earthbend 3, then earthbend 3. You gain 3 life.' })
  .oracleText('Earthbend 3, then earthbend 3. You gain 3 life. (To earthbend 3, target land you control becomes a 0/0 creature with haste that\'s still a land. Put three +1/+1 counters on it. When it dies or is exiled, return it to the battlefield tapped.)')
  .build();

export const EarthRumble = CardBuilder.create('Earth Rumble')
  .cost('{3}{G}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller);
    if (lands.length === 0) return;

    const targetLand = await ctx.choices.chooseOne(
      'Choose a land you control',
      lands,
      (card) => card.definition.name,
    );

    if (!targetLand || typeof targetLand === 'string') {
      return;
    }

    ctx.game.earthbendLand(targetLand.objectId, 2, ctx.controller);

    const yourCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }, ctx.controller);
    if (yourCreatures.length === 0) {
      return;
    }

    const chosenCreatures = await ctx.choices.chooseUpToN(
      'Choose up to one creature you control to fight',
      yourCreatures,
      1,
      (card) => card.definition.name,
    );
    const yourCreature = chosenCreatures[0];
    if (!yourCreature) {
      return;
    }

    const opposingCreatures = ctx.game
      .getBattlefield({ types: [CardType.CREATURE] })
      .filter((card) => card.controller !== ctx.controller);
    if (opposingCreatures.length === 0) {
      return;
    }

    const opposingCreature = await ctx.choices.chooseOne(
      'Choose a creature an opponent controls to fight',
      opposingCreatures,
      (card) => `${card.definition.name} (${card.controller})`,
    );
    if (!opposingCreature || typeof opposingCreature === 'string') {
      return;
    }

    ctx.game.fight(yourCreature.objectId, opposingCreature.objectId);
  }, { description: 'Earthbend 2, then up to one target creature you control fights target creature an opponent controls.' })
  .oracleText('Earthbend 2. When you do, up to one target creature you control fights target creature an opponent controls.')
  .build();

export const ElementalTeachings = CardBuilder.create('Elemental Teachings')
  .cost('{4}{G}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const library = ctx.game.getLibrary(ctx.controller);
    const uniqueLands: typeof library = [];
    const seenNames = new Set<string>();

    for (const card of library) {
      if (!card.definition.types.includes(CardType.LAND)) continue;
      if (seenNames.has(card.definition.name)) continue;
      seenNames.add(card.definition.name);
      uniqueLands.push(card);
    }

    if (uniqueLands.length === 0) {
      ctx.game.shuffleLibrary(ctx.controller);
      return;
    }

    const selected = await ctx.choices.chooseUpToN(
      'Search your library for up to four land cards with different names',
      uniqueLands,
      Math.min(4, uniqueLands.length),
      (card) => card.definition.name,
    );

    if (selected.length === 0) {
      ctx.game.shuffleLibrary(ctx.controller);
      return;
    }

    const opponents = ctx.game.getOpponents(ctx.controller);
    const chosenOpponent = opponents.length > 0
      ? await ctx.choices.choosePlayer('Choose an opponent to choose from the revealed lands', opponents)
      : null;
    if (!chosenOpponent) {
      for (const card of selected) {
        ctx.game.moveCard(card.objectId, 'GRAVEYARD', ctx.controller);
      }
      ctx.game.shuffleLibrary(ctx.controller);
      return;
    }
    const chosen = await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      chooser: chosenOpponent,
      filter: {
        custom: (candidate) => selected.some((card) => card.objectId === candidate.objectId),
      },
      destination: 'GRAVEYARD',
      count: Math.min(2, selected.length),
      optional: false,
      shuffle: false,
    });
    const chosenIds = new Set(chosen.map((card) => card.objectId));

    for (const card of selected) {
      if (chosenIds.has(card.objectId)) {
        continue;
      }

      ctx.game.moveCard(card.objectId, 'BATTLEFIELD', ctx.controller);
      const battlefieldCard = ctx.game.getCard(card.objectId);
      if (battlefieldCard) {
        battlefieldCard.tapped = true;
      }
    }

    ctx.game.shuffleLibrary(ctx.controller);
  }, { description: 'Search for up to four different land names. An opponent chooses two to graveyard, and the rest enter tapped.' })
  .oracleText('Search your library for up to four land cards with different names and reveal them. An opponent chooses two of those cards. Put the chosen cards into your graveyard and the rest onto the battlefield tapped, then shuffle.')
  .build();

export const BumisFeastLecture = CardBuilder.create("Bumi's Feast Lecture")
  .cost('{1}{G}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    ctx.game.createPredefinedToken(ctx.controller, 'Food');

    const foodCount = ctx.game.getBattlefield({ subtypes: ['Food'] }, ctx.controller).length;
    const earthbendCount = foodCount * 2;
    if (earthbendCount === 0) return;

    const lands = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller);
    if (lands.length === 0) return;

    const target = await ctx.choices.chooseOne(
      'Choose a land you control',
      lands,
      (card) => card.definition.name,
    );

    if (target && typeof target !== 'string') {
      ctx.game.earthbendLand(target.objectId, earthbendCount, ctx.controller);
    }
  }, { description: 'Create a Food token. Then earthbend twice the number of Foods you control.' })
  .oracleText('Create a Food token. Then earthbend X, where X is twice the number of Foods you control. (A Food token is an artifact with "{2}, {T}, Sacrifice this token:You gain 3 life." To earthbend X, target land you control becomes a 0/0 creature with haste that\'s still a land. Put X +1/+1 counters on it. When it dies or is exiled, return it to the battlefield tapped.)')
  .build();

export const BeastWithinSpell = CardBuilder.create('Beast Within')
  .cost('{2}{G}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const permanents = ctx.game.getBattlefield();
    if (permanents.length > 0) {
      const target = await ctx.choices.chooseOne('Destroy target permanent', permanents, c => c.definition.name);
      const controller = target.controller;
      ctx.game.destroyPermanent(target.objectId);
      ctx.game.createToken(controller, {
        name: 'Beast',
        types: [CardType.CREATURE],
        subtypes: ['Beast'],
        power: 3,
        toughness: 3,
        colorIdentity: [ManaColor.GREEN],
      });
    }
  }, { description: 'Destroy target permanent. Its controller creates a 3/3 Beast token.' })
  .oracleText('Destroy target permanent. Its controller creates a 3/3 green Beast creature token.')
  .build();

export const AlliesAtLast = CardBuilder.create('Allies at Last')
  .cost('{2}{G}')
  .types(CardType.INSTANT)
  .affinity({ subtypes: ['Ally'], controller: 'you' }, 'Affinity for Allies')
  .spellEffect((ctx) => {
    const opposingCreature = ctx.targets[ctx.targets.length - 1];
    if (!opposingCreature || typeof opposingCreature === 'string') {
      return;
    }

    const alliedCreatures = ctx.targets
      .slice(0, -1)
      .filter((target): target is typeof opposingCreature => Boolean(target) && typeof target !== 'string');

    for (const creature of alliedCreatures) {
      const power = creature.modifiedPower ?? creature.definition.power ?? 0;
      ctx.game.dealDamage(creature.objectId, opposingCreature.objectId, power, false);
    }
  }, {
    targets: [
      {
        what: 'creature',
        controller: 'you',
        count: 2,
        upTo: true,
      },
      {
        what: 'creature',
        controller: 'opponent',
        count: 1,
      },
    ],
    description: 'Up to two target creatures you control each deal damage equal to their power to target creature an opponent controls.',
  })
  .oracleText('Affinity for Allies (This spell costs {1} less to cast for each Ally you control.)\nUp to two target creatures you control each deal damage equal to their power to target creature an opponent controls.')
  .build();

export const BitterWork = CardBuilder.create('Bitter Work')
  .cost('{1}{R}{G}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ATTACKS || event.defender.type !== 'player' || !game.combat) {
          return false;
        }

        const qualifyingAttackers = [...game.combat.attackers.entries()].filter(([attackerId, defender]) => {
          if (defender.type !== 'player' || defender.id !== event.defender.id) {
            return false;
          }

          const attacker = findCard(game, attackerId);
          if (!attacker || attacker.controller !== source.controller) {
            return false;
          }

          const power = attacker.modifiedPower ?? attacker.definition.power ?? 0;
          return power >= 4;
        });

        return qualifyingAttackers.length > 0 && qualifyingAttackers[0]?.[0] === event.attackerId;
      },
    },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    {
      description: 'Whenever you attack a player with one or more creatures with power 4 or greater, draw a card.',
    },
  )
  .activated(
    {
      mana: parseManaCost('{4}'),
    },
    (ctx) => {
      const target = ctx.targets[0];
      if (target && typeof target !== 'string') {
        ctx.game.earthbendLand(target.objectId, 4, ctx.controller);
      }
    },
    {
      timing: 'instant',
      activateOnlyDuringYourTurn: true,
      isExhaust: true,
      targets: [{
        what: 'permanent',
        filter: { types: [CardType.LAND], controller: 'you' },
        count: 1,
      }],
      description: 'Exhaust — {4}: Earthbend 4. Activate only during your turn.',
    },
  )
  .oracleText('Whenever you attack a player with one or more creatures with power 4 or greater, draw a card.\nExhaust — {4}: Earthbend 4. Activate only during your turn.')
  .build();
