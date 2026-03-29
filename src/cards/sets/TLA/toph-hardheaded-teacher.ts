import { CardBuilder } from '../../CardBuilder';
import type { EffectContext } from '../../../engine/types';
import { CardType } from '../../../engine/types';

async function earthbendChosenLand(
  ctx: EffectContext,
  counterCount: number,
) {
  const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
  if (lands.length === 0) return;

  const target = await ctx.choices.chooseOne('Choose a land to earthbend', lands, c => c.definition.name);
  ctx.game.earthbendLand(target.objectId, counterCount, ctx.controller);
}

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
    {
      on: 'cast-spell',
      filter: {
        controller: 'you',
        custom: (card) => !(card.spellSubtypes ?? card.definition?.subtypes ?? []).includes('Lesson'),
      },
    },
    async (ctx) => {
      await earthbendChosenLand(ctx, 1);
    },
    { description: 'Whenever you cast a spell, earthbend 1.' },
  )
  .triggered(
    { on: 'cast-spell', filter: { controller: 'you', subtypes: ['Lesson'] } },
    async (ctx) => {
      await earthbendChosenLand(ctx, 2);
    },
    { description: 'Whenever you cast a Lesson spell, earthbend 2.' },
  )
  .build();
