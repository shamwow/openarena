import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { getEffectiveSubtypes } from '../../../engine/GameState';

export const SokkaSwordmaster = CardBuilder.create('Sokka, Swordmaster')
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 3)
  .vigilance()
  // TODO: Equipment spells cost {1} less for each Ally you control
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Cost reduction for equipment spells
      },
    },
    { description: 'Equipment spells you cast cost {1} less to cast for each Ally you control.' },
  )
  .triggered(
    { on: 'step', step: 'BEGINNING_OF_COMBAT' },
    async (ctx) => {
      if (ctx.state.activePlayer !== ctx.controller) return;
      const equipment = ctx.game.getBattlefield({ subtypes: ['Equipment'], controller: 'you' }, ctx.controller);
      if (equipment.length === 0) return;
      const chosen = await ctx.choices.chooseUpToN('Attach up to one Equipment to Sokka', equipment, 1, c => c.definition.name);
      for (const equip of chosen) {
        ctx.game.attachPermanent(equip.objectId, ctx.source.objectId);
      }
    },
    { description: 'At the beginning of combat on your turn, attach up to one target Equipment you control to Sokka.' },
  )
  .build();
