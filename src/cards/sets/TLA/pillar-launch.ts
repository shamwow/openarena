import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createReachAbilities } from '../../../engine/AbilityPrimitives';

export const PillarLaunch = CardBuilder.create('Pillar Launch')
  .cost('{G}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
    ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 2, 2);
    ctx.game.grantAbilitiesUntilEndOfTurn(
      ctx.source.objectId,
      target.objectId,
      target.zoneChangeCounter,
      createReachAbilities(),
    );
    ctx.game.untapPermanent(target.objectId);
  }, { description: 'Target creature gets +2/+2 and gains reach until end of turn. Untap it.' })
  .build();
