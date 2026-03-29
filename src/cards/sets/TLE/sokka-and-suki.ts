import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, GameEventType } from '../../../engine/types';
import { getEffectiveSubtypes } from '../../../engine/GameState';

export const SokkaAndSuki = CardBuilder.create('Sokka and Suki')
  .cost('{U}{R}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 3)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (event.controller !== source.controller) return false;
        const card = game.zones[event.controller]?.BATTLEFIELD.find(c => c.objectId === event.objectId);
        if (!card) return false;
        return card.objectId === source.objectId || getEffectiveSubtypes(card).includes('Ally');
      },
    },
    async (ctx) => {
      const equipment = ctx.game.getBattlefield({ subtypes: ['Equipment'], controller: 'you' }, ctx.controller);
      if (equipment.length === 0) return;
      const chosen = await ctx.choices.chooseUpToN('Attach up to one target Equipment to that creature', equipment, 1, c => c.definition.name);
      // TODO: Attach to the entering creature, not just any
      for (const equip of chosen) {
        ctx.game.attachPermanent(equip.objectId, ctx.source.objectId);
      }
    },
    { description: 'Whenever Sokka and Suki or another Ally you control enters, attach up to one target Equipment you control to that creature.' },
  )
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (event.controller !== source.controller) return false;
        const card = game.zones[event.controller]?.BATTLEFIELD.find(c => c.objectId === event.objectId);
        if (!card) return false;
        return getEffectiveSubtypes(card).includes('Equipment');
      },
    },
    async (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Ally',
        types: [CardType.CREATURE],
        subtypes: ['Ally'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
    },
    { description: 'Whenever an Equipment you control enters, create a 1/1 white Ally creature token.' },
  )
  .build();
