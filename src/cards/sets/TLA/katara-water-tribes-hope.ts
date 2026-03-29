import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

export const KataraWaterTribesHope = CardBuilder.create("Katara, Water Tribe's Hope")
  .cost('{2}{W}{U}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 3)
  .vigilance()
  .etbEffect((ctx) => {
    ctx.game.createToken(ctx.controller, {
      name: 'Ally',
      types: [CardType.CREATURE],
      subtypes: ['Ally'],
      power: 1,
      toughness: 1,
      colorIdentity: [ManaColor.WHITE],
    });
  }, { description: 'When Katara enters, create a 1/1 white Ally creature token.' })
  .activated(
    { mana: parseManaCost('{X}') },
    async (ctx) => {
      // TODO: X can't be 0. Need to properly get X from the cost paid.
      const x = ctx.costsPaid?.xValue ?? 1;
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' });
      for (const creature of creatures) {
        ctx.game.grantPumpToObjectsUntilEndOfTurn(
          [creature.objectId],
          x - (creature.modifiedPower ?? creature.definition.power ?? 0),
          x - (creature.modifiedToughness ?? creature.definition.toughness ?? 0),
        );
      }
    },
    {
      timing: 'sorcery',
      activateOnlyDuringYourTurn: true,
      description: 'Waterbend {X}: Creatures you control have base power and toughness X/X until end of turn. X can\'t be 0.',
    },
  )
  .waterbend(1)
  .build();
