import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, GameEventType, parseManaCost } from '../../../engine/types';
import { hasType } from '../../../engine/GameState';
import { createFlyingAbilities } from '../../../engine/AbilityPrimitives';

export const TheMechanistAerialArtisan = CardBuilder.create('The Mechanist, Aerial Artisan')
  .cost('{2}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Artificer', 'Ally')
  .stats(1, 3)
  .triggered(
    {
      on: 'custom',
      match: (event, source) =>
        event.type === GameEventType.SPELL_CAST
        && event.castBy === source.controller
        && !event.spellTypes.includes(CardType.CREATURE),
    },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Clue',
        types: [CardType.ARTIFACT],
        subtypes: ['Clue'],
        abilities: [{
          kind: 'activated' as const,
          cost: { mana: parseManaCost('{2}'), sacrifice: { self: true } },
          effect: (innerCtx) => {
            innerCtx.game.drawCards(innerCtx.controller, 1);
          },
          timing: 'instant' as const,
          isManaAbility: false,
          description: '{2}, Sacrifice this token: Draw a card.',
        }],
      });
    },
    { description: 'Whenever you cast a noncreature spell, create a Clue token.' },
  )
  .activated(
    { tap: true },
    async (ctx) => {
      const tokens = ctx.game.getBattlefield({
        types: [CardType.ARTIFACT],
        controller: 'you',
        isToken: true,
      }, ctx.controller);
      if (tokens.length === 0) return;
      const target = await ctx.choices.chooseOne(
        'Choose an artifact token you control',
        tokens,
        (c) => c.definition.name,
      );
      // TODO: Properly animate target into a 3/1 Construct artifact creature with flying until end of turn
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        target.objectId,
        target.zoneChangeCounter,
        createFlyingAbilities(),
      );
    },
    {
      timing: 'instant',
      description: '{T}: Until end of turn, target artifact token you control becomes a 3/1 Construct artifact creature with flying.',
    },
  )
  .build();
