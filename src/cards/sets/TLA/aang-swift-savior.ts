import { CardBuilder } from '../../CardBuilder';
import { CardType, Zone, parseManaCost } from '../../../engine/types';

const AangAndLaOceansFury = CardBuilder.create("Aang and La, Ocean's Fury")
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Avatar', 'Spirit', 'Ally')
  .stats(5, 5)
  .reach()
  .trample()
  .triggered(
    { on: 'attacks', filter: { self: true } },
    (ctx) => {
      const tappedCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(card => card.tapped);
      for (const creature of tappedCreatures) {
        ctx.game.addCounters(creature.objectId, '+1/+1', 1, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
    },
    { description: 'Whenever Aang and La attack, put a +1/+1 counter on each tapped creature you control.' },
  )
  .build();

export const AangSwiftSavior = CardBuilder.create('Aang, Swift Savior')
  .cost('{1}{W}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Avatar', 'Ally')
  .stats(2, 3)
  .flash()
  .flying()
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] })
      .filter(card => card.objectId !== ctx.source.objectId);
    const spells = ctx.state.stack
      .map(entry => entry.cardInstance)
      .filter((card): card is NonNullable<typeof card> => Boolean(card))
      .filter(card => card.objectId !== ctx.source.objectId);
    const targets = [...creatures, ...spells];
    if (targets.length === 0) return;
    const chosen = await ctx.choices.chooseUpToN(
      'Airbend up to one other target creature or spell',
      targets,
      1,
      card => card.definition.name,
    );
    for (const target of chosen) {
      ctx.game.airbendObject(target.objectId, { mana: parseManaCost('{2}') }, ctx.controller);
    }
  }, { description: 'When Aang enters, airbend up to one other target creature or spell.' })
  .activated(
    {
      mana: parseManaCost('{8}'),
      genericTapSubstitution: {
        amount: 8,
        filter: { types: [CardType.ARTIFACT, CardType.CREATURE], controller: 'you' },
        ignoreSummoningSickness: true,
        keywordAction: 'waterbend',
      },
    },
    (ctx) => {
      ctx.game.transformPermanent(ctx.source.objectId);
    },
    { description: 'Waterbend {8}: Transform Aang.' },
  )
  .transform(AangAndLaOceansFury)
  .build();
