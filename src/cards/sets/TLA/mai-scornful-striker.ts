import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const MaiScornfulStriker = CardBuilder.create('Mai, Scornful Striker')
  .cost('{1}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(2, 2)
  .firstStrike()
  .triggered(
    {
      on: 'cast-spell',
      filter: {
        custom: (card) => !card.spellTypes?.includes(CardType.CREATURE),
      },
    },
    (ctx) => {
      const caster = ctx.triggerEvent && 'castBy' in ctx.triggerEvent ? (ctx.triggerEvent as any).castBy : ctx.controller;
      ctx.game.loseLife(caster, 2);
    },
    { description: 'Whenever a player casts a noncreature spell, they lose 2 life.' },
  )
  .build();
