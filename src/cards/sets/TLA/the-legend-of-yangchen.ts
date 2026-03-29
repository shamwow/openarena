import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType, manaCostTotal, parseManaCost } from '../../../engine/types';

const AangMasterAirbendCost = { mana: parseManaCost('{2}') };

const AvatarYangchen = CardBuilder.create('Avatar Yangchen')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Avatar')
  .stats(4, 5)
  .flying()
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) =>
        event.type === GameEventType.SPELL_CAST &&
        event.castBy === source.controller &&
        (game.players[source.controller].spellsCastThisTurn ?? 0) === 2,
    },
    async (ctx) => {
      const permanents = ctx.game.getBattlefield().filter(card =>
        card.objectId !== ctx.source.objectId &&
        !card.definition.types.includes(CardType.LAND),
      );
      if (permanents.length === 0) return;
      const chosen = await ctx.choices.chooseUpToN(
        'Airbend up to one other target nonland permanent',
        permanents,
        1,
        card => card.definition.name,
      );
      for (const target of chosen) {
        ctx.game.airbendObject(target.objectId, AangMasterAirbendCost, ctx.controller);
      }
    },
    { description: 'Whenever you cast your second spell each turn, airbend up to one other target nonland permanent.' },
  )
  .build();

export const TheLegendOfYangchen = CardBuilder.create('The Legend of Yangchen')
  .cost('{3}{W}{W}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Saga')
  .saga([
    {
      chapter: 1,
      effect: async (ctx) => {
        const orderedPlayers = [
          ctx.controller,
          ...ctx.game.getActivePlayers().filter(player => player !== ctx.controller),
        ];
        const chosenIds = new Set<string>();
        for (const chooser of orderedPlayers) {
          const options = ctx.game.getBattlefield().filter(card => {
            if (chosenIds.has(card.objectId)) return false;
            if (manaCostTotal(card.definition.cost?.mana ?? { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 }) < 3) return false;
            return ctx.game.getOpponents(chooser).includes(card.controller);
          });
          if (options.length === 0) continue;
          const chosen = await ctx.choices.chooseUpToN(
            `Choose up to one permanent with mana value 3 or greater to exile for ${chooser}`,
            options,
            1,
            card => card.definition.name,
          );
          for (const card of chosen) {
            chosenIds.add(card.objectId);
          }
        }
        for (const objectId of chosenIds) {
          ctx.game.moveCard(objectId, 'EXILE');
        }
      },
    },
    {
      chapter: 2,
      effect: async (ctx) => {
        const doDraw = await ctx.choices.chooseYesNo('Have target opponent draw three cards?');
        if (!doDraw) return;
        const opponents = ctx.game.getOpponents(ctx.controller);
        if (opponents.length === 0) return;
        const target = await ctx.choices.choosePlayer('Choose target opponent to draw three cards', opponents);
        ctx.game.drawCards(target, 3);
        ctx.game.drawCards(ctx.controller, 3);
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
  .transform(AvatarYangchen)
  .build();
