import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard } from '../../../engine/GameState';

export const TophHardheadedTeacher = CardBuilder.create('Toph, Hardheaded Teacher')
  .cost('{2}{R}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 4)
  .etbEffect(async (ctx) => {
    const hand = ctx.game.getHand(ctx.controller);
    if (hand.length === 0) return;
    const wantDiscard = await ctx.choices.chooseYesNo('Discard a card to return an instant or sorcery from your graveyard?');
    if (!wantDiscard) return;
    const toDiscard = await ctx.choices.chooseOne('Choose a card to discard', hand, c => c.definition.name);
    ctx.game.discardCard(ctx.controller, toDiscard.objectId);
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const targets = graveyard.filter(c =>
      c.definition.types.includes(CardType.INSTANT) || c.definition.types.includes(CardType.SORCERY),
    );
    if (targets.length > 0) {
      const target = await ctx.choices.chooseOne('Return an instant or sorcery to your hand', targets, c => c.definition.name);
      ctx.game.returnToHand(target.objectId);
    }
  }, { optional: true, description: 'When Toph enters, you may discard a card. If you do, return target instant or sorcery card from your graveyard to your hand.' })
  .triggered(
    { on: 'cast-spell', filter: { controller: 'you' } },
    async (ctx) => {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend 1', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, 1, ctx.controller);
        // TODO: If the spell is a Lesson, put an additional +1/+1 counter on that land
      }
    },
    { description: 'Whenever you cast a spell, earthbend 1. If that spell is a Lesson, put an additional +1/+1 counter on that land.' },
  )
  .build();
