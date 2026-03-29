import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const RavenEagle = CardBuilder.create('Raven Eagle')
  .cost('{2}{B}')
  .types(CardType.CREATURE)
  .subtypes('Bird', 'Assassin')
  .stats(2, 3)
  .flying()
  .triggered(
    { on: 'enter-battlefield-or-attacks', filter: { self: true } },
    async (ctx) => {
      const allGraveyards: import('../../../engine/types').CardInstance[] = [];
      for (const player of ctx.game.getActivePlayers()) {
        allGraveyards.push(...ctx.game.getGraveyard(player));
      }
      if (allGraveyards.length === 0) return;
      const chosen = await ctx.choices.chooseUpToN('Exile up to one target card from a graveyard', allGraveyards, 1, c => c.definition.name);
      for (const card of chosen) {
        const isCreature = card.definition.types.includes(CardType.CREATURE);
        ctx.game.moveCard(card.objectId, 'EXILE');
        if (isCreature) {
          ctx.game.createPredefinedToken(ctx.controller, 'Clue');
        }
      }
    },
    { description: 'Whenever this creature enters or attacks, exile up to one target card from a graveyard. If a creature card is exiled this way, create a Clue token.' },
  )
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.DREW_CARD) return false;
        if ((event as any).player !== source.controller) return false;
        const drawCount = game.eventLog.filter(
          (e) => e.type === GameEventType.DREW_CARD
            && (e as any).player === source.controller
            && e.timestamp >= (game.turnStartTimestamp ?? 0),
        ).length;
        return drawCount === 2;
      },
    },
    async (ctx) => {
      for (const opponent of ctx.game.getOpponents(ctx.controller)) {
        ctx.game.loseLife(opponent, 1);
      }
      ctx.game.gainLife(ctx.controller, 1);
    },
    { description: 'Whenever you draw your second card each turn, each opponent loses 1 life and you gain 1 life.' },
  )
  .build();
