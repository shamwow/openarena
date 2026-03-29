import { CardBuilder } from '../../CardBuilder';
import type { CardInstance, EffectContext, ManaCost } from '../../../engine/types';
import { CardType, GameEventType, manaCostTotal, parseManaCost } from '../../../engine/types';

const EMPTY_MANA_COST: ManaCost = { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 };

function getCardManaValue(card: CardInstance) {
  return manaCostTotal(
    card.definition.cost?.mana ?? EMPTY_MANA_COST,
  );
}

async function chooseCardsUpToManaValue(
  ctx: EffectContext,
  cards: CardInstance[],
  maxManaValue: number,
) {
  const chosen: typeof cards = [];
  let remainingManaValue = maxManaValue;
  let remainingCards = [...cards];

  while (true) {
    const eligible = remainingCards.filter((card) => getCardManaValue(card) <= remainingManaValue);
    if (eligible.length === 0) {
      break;
    }

    const chooseAnother = await ctx.choices.chooseYesNo(
      chosen.length === 0
        ? `Choose a creature card with total mana value ${maxManaValue} or less?`
        : `Choose another creature card? (${remainingManaValue} mana value remaining)`,
    );
    if (!chooseAnother) {
      break;
    }

    const selected = await ctx.choices.chooseOne(
      `Choose a creature card with mana value ${remainingManaValue} or less`,
      eligible,
      (card) => `${card.definition.name} (mana value ${getCardManaValue(card)})`,
    );

    chosen.push(selected);
    remainingManaValue -= getCardManaValue(selected);
    remainingCards = remainingCards.filter((card) => card.objectId !== selected.objectId);
  }

  return chosen;
}

const FireLordSozin = CardBuilder.create('Fire Lord Sozin')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble')
  .stats(5, 5)
  .menace()
  .firebending(3)
  .triggered(
    {
      on: 'custom',
      match: (event, source) =>
        event.type === GameEventType.DAMAGE_DEALT &&
        event.sourceId === source.objectId &&
        event.isCombatDamage &&
        typeof event.targetId === 'string',
    },
    async (ctx) => {
      if (!ctx.event || ctx.event.type !== GameEventType.DAMAGE_DEALT) return;
      const defendingPlayer = ctx.event.targetId;
      const graveyard = ctx.game.getGraveyard(defendingPlayer).filter(card => card.definition.types.includes(CardType.CREATURE));
      if (graveyard.length === 0) return;

      const maxX = graveyard.reduce((sum, card) => sum + getCardManaValue(card), 0);
      const affordableXValues = Array.from({ length: maxX + 1 }, (_, index) => maxX - index).filter((value) =>
        ctx.game.canAffordAuxiliaryCost(ctx.controller, ctx.source.objectId, { mana: parseManaCost(`{${value}}`) }),
      );
      if (affordableXValues.length === 0) return;

      const chosenX = await ctx.choices.chooseOne(
        'Choose a value for X',
        affordableXValues,
        (value) => String(value),
      );
      const chosen = await chooseCardsUpToManaValue(ctx, graveyard, chosenX);
      const paid = await ctx.game.payAuxiliaryCost(
        ctx.controller,
        ctx.source.objectId,
        { mana: parseManaCost(`{${chosenX}}`) },
      );
      if (!paid) return;

      for (const card of chosen) {
        ctx.game.moveCard(card.objectId, 'BATTLEFIELD', ctx.controller);
      }
    },
    { optional: true, description: "Whenever Fire Lord Sozin deals combat damage to a player, you may pay {X}. When you do, put any number of target creature cards with total mana value X or less from that player's graveyard onto the battlefield under your control." },
  )
  .build();

export const TheRiseOfSozin = CardBuilder.create('The Rise of Sozin')
  .cost('{4}{B}{B}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Saga')
  .saga([
    {
      chapter: 1,
      effect: (ctx) => {
        for (const creature of ctx.game.getBattlefield({ types: [CardType.CREATURE] })) {
          ctx.game.destroyPermanent(creature.objectId);
        }
      },
    },
    {
      chapter: 2,
      effect: async (ctx) => {
        const opponents = ctx.game.getOpponents(ctx.controller);
        if (opponents.length === 0) return;
        const targetOpponent = await ctx.choices.choosePlayer('Choose target opponent', opponents);
        const graveyard = ctx.game.getGraveyard(targetOpponent);
        const hand = ctx.game.getHand(targetOpponent);
        const library = ctx.game.getLibrary(targetOpponent);
        const availableNames = Array.from(new Set([...graveyard, ...hand, ...library].map(card => card.definition.name)));
        if (availableNames.length === 0) return;
        const chosenName = await ctx.choices.chooseOne('Choose a card name', availableNames, name => name);
        const matchingCards = [...graveyard, ...hand, ...library]
          .filter(card => card.definition.name === chosenName)
          .slice(0, 4);
        for (const card of matchingCards) {
          ctx.game.moveCard(card.objectId, 'EXILE', targetOpponent);
        }
        ctx.game.shuffleLibrary(targetOpponent);
      },
    },
    {
      chapter: 3,
      effect: (ctx) => {
        ctx.game.moveCard(ctx.source.objectId, 'EXILE', ctx.controller);
        ctx.game.moveCard(ctx.source.objectId, 'BATTLEFIELD', ctx.controller, { transformed: true });
      },
    },
  ])
  .transform(FireLordSozin)
  .build();
