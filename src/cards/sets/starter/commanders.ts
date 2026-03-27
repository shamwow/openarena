import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

// Commander 1: White — Heliod, Sun-Crowned (simplified)
export const HeliodSunCrowned = CardBuilder.create('Heliod, Sun-Crowned')
  .cost('{2}{W}')
  .types(CardType.ENCHANTMENT, CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('God')
  .stats(5, 5)
  .colors(ManaColor.WHITE)
  .indestructible()
  .triggered(
    { on: 'gain-life', whose: 'yours' },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' });
      if (creatures.length > 0) {
        const target = await ctx.choices.chooseOne('Put a +1/+1 counter on target creature or enchantment', creatures, c => c.definition.name);
        ctx.game.addCounters(target.objectId, '+1/+1', 1, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
    },
    { description: 'Whenever you gain life, put a +1/+1 counter on target creature or enchantment you control.' }
  )
  .oracleText('Indestructible\nWhenever you gain life, put a +1/+1 counter on target creature or enchantment you control.')
  .build();

// Commander 2: Blue — Talrand, Sky Summoner
export const TalrandSkySummoner = CardBuilder.create('Talrand, Sky Summoner')
  .cost('{2}{U}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Merfolk', 'Wizard')
  .stats(2, 2)
  .colors(ManaColor.BLUE)
  .triggered(
    { on: 'cast-spell', filter: { controller: 'you', types: [CardType.INSTANT] } },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Drake',
        types: [CardType.CREATURE],
        subtypes: ['Drake'],
        power: 2,
        toughness: 2,
        colorIdentity: [ManaColor.BLUE],
        keywords: ['Flying' as import('../../../engine/types').Keyword],
      });
    },
    { description: 'Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token with flying.' }
  )
  .triggered(
    { on: 'cast-spell', filter: { controller: 'you', types: [CardType.SORCERY] } },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Drake',
        types: [CardType.CREATURE],
        subtypes: ['Drake'],
        power: 2,
        toughness: 2,
        colorIdentity: [ManaColor.BLUE],
        keywords: ['Flying' as import('../../../engine/types').Keyword],
      });
    },
    { description: 'Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token with flying.' }
  )
  .oracleText('Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token with flying.')
  .build();

// Commander 3: Black — Ayara, First of Locthwain
export const AyaraFirstOfLocthwain = CardBuilder.create('Ayara, First of Locthwain')
  .cost('{B}{B}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Elf', 'Noble')
  .stats(2, 3)
  .colors(ManaColor.BLACK)
  .triggered(
    { on: 'enter-battlefield', filter: { types: [CardType.CREATURE], controller: 'you' } },
    (ctx) => {
      const opponents = ctx.game.getOpponents(ctx.controller);
      for (const opp of opponents) {
        ctx.game.loseLife(opp, 1);
      }
      ctx.game.gainLife(ctx.controller, 1);
    },
    { description: 'Whenever a black creature enters the battlefield under your control, each opponent loses 1 life and you gain 1 life.' }
  )
  .activated(
    { tap: true, sacrifice: { types: [CardType.CREATURE], controller: 'you' } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{T}, Sacrifice another creature: Draw a card.' }
  )
  .oracleText('Whenever a black creature enters the battlefield under your control, each opponent loses 1 life and you gain 1 life.\n{T}, Sacrifice another creature: Draw a card.')
  .build();

// Commander 4: Red — Krenko, Mob Boss
export const KrenkoMobBoss = CardBuilder.create('Krenko, Mob Boss')
  .cost('{2}{R}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Goblin', 'Warrior')
  .stats(3, 3)
  .colors(ManaColor.RED)
  .activated(
    { tap: true },
    (ctx) => {
      // Count goblins you control
      const goblins = ctx.game.getBattlefield({ subtypes: ['Goblin'], controller: 'you' });
      const count = goblins.length;
      for (let i = 0; i < count; i++) {
        ctx.game.createToken(ctx.controller, {
          name: 'Goblin',
          types: [CardType.CREATURE],
          subtypes: ['Goblin'],
          power: 1,
          toughness: 1,
          colorIdentity: [ManaColor.RED],
        });
      }
    },
    { timing: 'sorcery', description: '{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.' }
  )
  .oracleText('{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.')
  .build();

// Commander 5: Green — Marwyn, the Nurturer (bonus for green deck)
export const MarwynTheNurturer = CardBuilder.create('Marwyn, the Nurturer')
  .cost('{2}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Elf', 'Druid')
  .stats(1, 1)
  .colors(ManaColor.GREEN)
  .triggered(
    { on: 'enter-battlefield', filter: { subtypes: ['Elf'], controller: 'you' } },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever another Elf enters the battlefield under your control, put a +1/+1 counter on Marwyn.' }
  )
  .activated(
    { tap: true },
    (ctx) => {
      const power = ctx.source.modifiedPower ?? ctx.source.definition.power ?? 0;
      if (power > 0) {
        ctx.game.addMana(ctx.controller, 'G', power);
      }
    },
    { isManaAbility: true, description: '{T}: Add an amount of {G} equal to Marwyn\'s power.' }
  )
  .oracleText('Whenever another Elf enters the battlefield under your control, put a +1/+1 counter on Marwyn, the Nurturer.\n{T}: Add an amount of {G} equal to Marwyn\'s power.')
  .build();
