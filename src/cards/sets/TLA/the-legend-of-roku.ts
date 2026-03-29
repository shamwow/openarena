import { CardBuilder } from '../../CardBuilder';
import { Cost } from '../../../engine/costs';
import { createFlyingAbilities } from '../../../engine/AbilityPrimitives';
import { CardType, parseManaCost } from '../../../engine/types';

const AvatarRoku = CardBuilder.create('Avatar Roku')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Avatar')
  .stats(4, 4)
  .firebending(4)
  .activated(
    { mana: parseManaCost('{8}') },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Dragon',
        types: [CardType.CREATURE],
        subtypes: ['Dragon'],
        power: 4,
        toughness: 4,
        colorIdentity: ['R'],
        abilities: [
          ...createFlyingAbilities(),
          {
            kind: 'triggered',
            trigger: { on: 'attacks', filter: { self: true } },
            effect: (innerCtx) => {
              innerCtx.game.recordActionPerformed(innerCtx.controller, 'keyword-action', 'firebend', innerCtx.source.objectId);
              innerCtx.game.addMana(innerCtx.controller, 'R', 4);
            },
            manaProduction: [{ amount: 4, colors: ['R'] }],
            isManaAbility: true,
            optional: false,
            description: 'Firebending 4',
          },
        ],
      });
    },
    { description: '{8}: Create a 4/4 red Dragon creature token with flying and firebending 4.' },
  )
  .build();

export const TheLegendOfRoku = CardBuilder.create('The Legend of Roku')
  .cost('{2}{R}{R}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Saga')
  .saga([
    {
      chapter: 1,
      effect: (ctx) => {
        const library = ctx.game.getLibrary(ctx.controller);
        const topCards = library.slice(-3);
        if (topCards.length === 0) return;
        const trackedPermissions: Array<{ objectId: string; zoneChangeCounter: number }> = [];
        for (const card of topCards) {
          ctx.game.moveCard(card.objectId, 'EXILE', ctx.controller);
          const exiledCard = ctx.game.getCard(card.objectId);
          if (!exiledCard) continue;
          if (!exiledCard.definition.types.includes(CardType.LAND)) {
            ctx.state.castPermissions.push({
              objectId: exiledCard.objectId,
              zoneChangeCounter: exiledCard.zoneChangeCounter,
              zone: 'EXILE',
              castBy: ctx.controller,
              owner: exiledCard.owner,
              alternativeCost: Cost.from(exiledCard.definition.cost).toPlainCost(),
              reason: 'legend-of-roku',
              timing: 'normal',
              castOnly: true,
            });
            trackedPermissions.push({
              objectId: exiledCard.objectId,
              zoneChangeCounter: exiledCard.zoneChangeCounter,
            });
          }
        }
        const currentTurn = ctx.state.turnNumber;
        if (trackedPermissions.length > 0) {
          ctx.game.registerDelayedTrigger({
            id: `legend-of-roku-cleanup:${ctx.source.objectId}:${ctx.source.zoneChangeCounter}:${currentTurn}`,
            source: ctx.source,
            controller: ctx.controller,
            expiresAfterTrigger: true,
            ability: {
              kind: 'triggered',
              trigger: {
                on: 'custom',
                match: (event, source, game) =>
                  event.type === 'STEP_CHANGE' &&
                  event.step === 'END' &&
                  event.activePlayer === source.controller &&
                  game.turnNumber > currentTurn,
              },
              optional: false,
              description: 'Remove Legend of Roku cast permissions.',
              effect: (innerCtx) => {
                innerCtx.state.castPermissions = innerCtx.state.castPermissions.filter(permission =>
                  !trackedPermissions.some(tracked =>
                    tracked.objectId === permission.objectId &&
                    tracked.zoneChangeCounter === permission.zoneChangeCounter,
                  ),
                );
              },
            },
          });
        }
      },
    },
    {
      chapter: 2,
      effect: async (ctx) => {
        const color = await ctx.choices.chooseOne(
          'Choose a color of mana to add',
          ['W', 'U', 'B', 'R', 'G'] as const,
          mana => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[mana]),
        );
        ctx.game.addMana(ctx.controller, color, 1);
      },
    },
    {
      chapter: 3,
      effect: (ctx) => {
        ctx.game.moveCard(ctx.source.objectId, 'EXILE', ctx.controller);
        ctx.game.moveCard(ctx.source.objectId, 'BATTLEFIELD', ctx.controller, { transformed: true });
      },
    },
  ])
  .transform(AvatarRoku)
  .build();
