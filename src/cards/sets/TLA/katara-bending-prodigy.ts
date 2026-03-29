import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const KataraBendingProdigy = CardBuilder.create('Katara, Bending Prodigy')
  .cost('{2}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(2, 3)
  .triggered(
    { on: 'end-step', whose: 'yours' },
    (ctx) => {
      if (ctx.source.tapped) {
        ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1);
      }
    },
    {
      description: 'At the beginning of your end step, if Katara is tapped, put a +1/+1 counter on her.',
    },
  )
  .activated(
    { mana: parseManaCost('{6}'), genericTapSubstitution: { amount: 6, filter: { types: [CardType.ARTIFACT, CardType.CREATURE], controller: 'you' }, ignoreSummoningSickness: true, keywordAction: 'waterbend' } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    {
      description: 'Waterbend {6}: Draw a card.',
    },
  )
  .build();
