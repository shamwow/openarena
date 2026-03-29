import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFirstStrikeAbilities, createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const FranticConfrontation = CardBuilder.create('Frantic Confrontation')
  .cost('{X}{R}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const x = ctx.xValue ?? 0;
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature you control', creatures, c => c.definition.name);
    ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], x, 0);
    ctx.game.grantAbilitiesUntilEndOfTurn(
      ctx.source.objectId,
      target.objectId,
      target.zoneChangeCounter,
      [...createFirstStrikeAbilities(), ...createTrampleAbilities()],
    );
  }, { description: 'Target creature you control gets +X/+0 and gains first strike and trample until end of turn.' })
  .build();
