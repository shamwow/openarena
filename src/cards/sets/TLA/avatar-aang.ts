import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

const AangMasterOfElements = CardBuilder.create('Aang, Master of Elements')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Avatar', 'Ally')
  .stats(6, 6)
  .flying()
  .staticAbility(
    {
      type: 'cost-modification',
      reductionBudget: { W: 1, U: 1, B: 1, R: 1, G: 1 },
      spillUnusedColoredToGeneric: true,
      filter: { controller: 'you' },
    },
    { description: 'Spells you cast cost {W}{U}{B}{R}{G} less to cast. (This can reduce generic costs.)' },
  )
  .triggered(
    { on: 'upkeep', whose: 'each' },
    (ctx) => {
      ctx.game.transformPermanent(ctx.source.objectId);
      ctx.game.gainLife(ctx.controller, 4);
      ctx.game.drawCards(ctx.controller, 4);
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 4, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
      for (const opponent of ctx.game.getOpponents(ctx.controller)) {
        ctx.game.dealDamage(ctx.source.objectId, opponent, 4, false);
      }
    },
    { optional: true, description: 'At the beginning of each upkeep, you may transform Aang, Master of Elements. If you do, you gain 4 life, draw four cards, put four +1/+1 counters on him, and he deals 4 damage to each opponent.' },
  )
  .build();

export const AvatarAang = CardBuilder.create('Avatar Aang')
  .cost('{R}{G}{W}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Avatar', 'Ally')
  .stats(4, 4)
  .flying()
  .firebending(2)
  .triggered(
    {
      on: 'custom',
      match: (event, source) =>
        event.type === GameEventType.ACTION_PERFORMED &&
        event.player === source.controller &&
        event.actionKind === 'keyword-action',
    },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
      const bendActions = new Set<string>();
      for (let index = ctx.state.eventLog.length - 1; index >= 0; index -= 1) {
        const event = ctx.state.eventLog[index];
        if (event.type === GameEventType.TURN_START) break;
        if (
          event.type === GameEventType.ACTION_PERFORMED &&
          event.player === ctx.controller &&
          event.actionKind === 'keyword-action'
        ) {
          bendActions.add(event.actionName);
        }
      }
      if (
        bendActions.has('waterbend') &&
        bendActions.has('earthbend') &&
        bendActions.has('firebend') &&
        bendActions.has('airbend')
      ) {
        ctx.game.transformPermanent(ctx.source.objectId);
      }
    },
    { description: "Whenever you waterbend, earthbend, firebend, or airbend, draw a card. Then if you've done all four this turn, transform Avatar Aang." },
  )
  .transform(AangMasterOfElements)
  .build();
