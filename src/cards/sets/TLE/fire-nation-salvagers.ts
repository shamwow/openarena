import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FireNationSalvagers = CardBuilder.create('Fire Nation Salvagers')
  .cost('{3}{B}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(3, 3)
  .menace()
  .etbEffect(async (ctx) => {
    const targets = ctx.game.getBattlefield({ controller: 'you' }, ctx.controller)
      .filter(c => c.definition.types.includes(CardType.CREATURE) || c.definition.subtypes.includes('Vehicle'));
    if (targets.length === 0) return;
    const target = await ctx.choices.chooseOne('Put a +1/+1 counter on target creature or Vehicle', targets, c => c.definition.name);
    ctx.game.addCounters(target.objectId, '+1/+1', 1);
  }, { description: 'When this creature enters, put a +1/+1 counter on target creature or Vehicle you control.' })
  .triggered(
    { on: 'deals-combat-damage-to-player', filter: { controller: 'you' } },
    async (ctx) => {
      // TODO: Properly check if the dealing creature has counters on it
      const opponents = ctx.game.getOpponents(ctx.controller);
      for (const opp of opponents) {
        const graveyard = ctx.game.getGraveyard(opp);
        const creatureOrVehicle = graveyard.filter(c =>
          c.definition.types.includes(CardType.CREATURE) || c.definition.subtypes.includes('Vehicle'),
        );
        if (creatureOrVehicle.length > 0) {
          const chosen = await ctx.choices.chooseUpToN(
            'Choose a creature or Vehicle card from that graveyard',
            creatureOrVehicle,
            1,
            c => c.definition.name,
          );
          for (const card of chosen) {
            ctx.game.moveCard(card.objectId, 'BATTLEFIELD', ctx.controller);
          }
        }
      }
    },
    { description: "Whenever one or more creatures you control with counters on them deal combat damage to a player, put target creature or Vehicle card from that player's graveyard onto the battlefield under your control." },
  )
  .build();
