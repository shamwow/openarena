import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

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

export const Ponder = CardBuilder.create('Ponder')
  .cost('{U}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    // Look at top 3, reorder or shuffle, then draw
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'Look at the top three cards of your library. Put them back or shuffle. Draw a card.' })
  .oracleText('Look at the top three cards of your library, then put them back in any order. You may shuffle your library.\nDraw a card.')
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
