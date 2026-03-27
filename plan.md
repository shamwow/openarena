# Commander Engine Implementation Plan

## Goal

Bring the game engine to a solid 4-player Commander baseline with correct multiplayer combat, commander rules, and support for common Commander staple mechanics.

This plan is intentionally scoped to Commander. It does not try to make the engine XMage-complete across all Magic formats.

## Target Scope

### In scope

- 4-player free-for-all Commander only
- Correct commander casting, tax, damage tracking, and zone-change behavior
- Partner and partner-variant commanders (Partner, Partner With, Friends Forever, Choose a Background)
- Multiplayer combat rules relevant to Commander including goad
- Static abilities, attack restrictions, taxes, ward, and common replacement/prevention behavior
- Equipment, aura, and attachment rules as a first-class engine subsystem
- Hybrid mana, phyrexian mana, and color identity mana production rules
- Common Commander staple patterns such as "unless that player pays"
- Sacrifice as a cost and as an effect
- Library search (tutors), shuffle, and reveal mechanics
- Extra turns and "end the turn" effects
- Player elimination and multiplayer cleanup
- Common keyword mechanics: kicker, cascade, cycling, overload, storm, flashback, regeneration, landfall
- Token type system (Treasure, Clue, Food, Blood, and custom tokens)
- Voting and political multiplayer mechanics
- Deterministic engine tests and UI test states for core Commander scenarios

### Out of scope for now

- Non-Commander formats
- Variable player counts beyond the current 4-player table
- Tournament systems, matchmaking, or server architecture
- AI
- Draft, sealed, cube, or non-Commander deck rules
- Planechase, Archenemy, and other Commander-adjacent variants unless product scope changes
- Banding (archaic, rarely relevant in Commander)
- Mutate (complex, narrow usage)

## Guiding Principles

1. Fix engine correctness before expanding card coverage.
2. Prefer shared engine primitives over one-off card implementations.
3. Add tests for every new rules primitive before leaning on it in more cards.
4. Keep Commander-specific features first-class instead of hiding them in UI-only flows.

## Recommended Delivery Model

Implement this as a sequence of focused PRs. Each PR should:

- change one engine area at a time;
- add deterministic engine tests;
- add or update at least one `test-game-state` fixture when the feature affects gameplay UX;
- avoid expanding card coverage until the underlying primitive is stable.

## Milestone 0: Test Harness First

### Objective

Create an engine-focused test suite so future rules work is measurable and safe.

### Key changes

- Add a dedicated `test:engine` script.
- Add helpers for building deterministic game states and asserting combat, stack, and zone outcomes.
- Add initial regression fixtures for:
  - commander death and recast;
  - commander bounce and command zone choice;
  - Propaganda and Ghostly Prison attack tax;
  - Rhystic Study and Smothering Tithe;
  - first strike plus deathtouch;
  - ward and modal targeting.

### Candidate files

- `package.json`
- `src/testing/testGameStates.ts`
- `src/testing/testGameStateBuilder.ts`
- new `test/unit/engine/**`

### Exit criteria

- `npm run test:engine` exists and runs locally.
- There is at least one failing test for each major gap below before implementation starts.

## Milestone 1: Object Identity, Zone Changes, and LKI

### Objective

Replace the current "one object moves everywhere" model with a Commander-safe identity model.

### Why this comes first

The current engine reuses the same `CardInstance` and `objectId` across zones. That makes commander tax, dies triggers, blink effects, and retargeting edge cases fundamentally unreliable.

### Key changes

- Split card identity from object identity:
  - add a stable card identity for the physical commander card;
  - keep a mutable object identity for each zone incarnation.
- Add `zoneChangeCounter`.
- Capture last-known information for objects that leave battlefield and stack.
- Ensure ETB/LTB/dies checks use the correct identity and, when needed, LKI.
- Define the engine rule for when an object becomes a new object after zone change.

### Candidate files

- `src/engine/types.ts`
- `src/engine/GameState.ts`
- `src/engine/ZoneManager.ts`
- `src/engine/GameEngine.ts`
- `src/engine/EventBus.ts`
- `src/engine/StackManager.ts`

### Exit criteria

- A commander that dies, gets recast, blinked, bounced, or reanimated is treated as a new object when appropriate.
- Old triggers and references do not accidentally resolve against the new incarnation.
- Tests cover at least:
  - dies trigger after sacrifice;
  - blinked permanent returning as a new object;
  - commander recast after death.

## Milestone 2: Commander Zone-Change Rules and Partner Commanders

### Objective

Make commander movement rules engine-driven instead of action-driven, and support partner-variant commanders.

### Why this matters

Commander replacement/choice behavior is central to the format. It should not rely on a manual special action to clean up engine shortcomings. Partner commanders are common enough that dual-commander support must be first-class.

### Key changes

- Move commander replacement logic into zone-change handling.
- Support the command-zone choice when a commander would go to:
  - graveyard;
  - exile;
  - hand;
  - library.
- Track commander damage by stable commander identity, not the current battlefield object id.
- Keep commander tax tied to the commander card across zone changes.
- Decide and encode the precise Commander rules version you want to follow for command-zone replacement timing.
- Add partner commander support:
  - allow two commanders with Partner, Partner With, Friends Forever, or Choose a Background;
  - track separate commander tax for each partner;
  - track separate commander damage per-commander per-opponent;
  - compute color identity as the union of both commanders;
  - both commanders independently castable from the command zone.

### Candidate files

- `src/engine/ZoneManager.ts`
- `src/engine/GameEngine.ts`
- `src/engine/GameState.ts`
- `src/engine/types.ts`

### Exit criteria

- Commander death, exile, bounce, and tuck behave consistently.
- Commander tax persists across re-casts.
- Commander damage is still correctly attributed after a commander changes zones and is cast again.
- Partner commanders each have independent tax and damage tracking.
- Color identity is correctly computed from partner pairs.

## Milestone 3: Player Elimination in Multiplayer

### Objective

Handle player loss mid-game correctly so the remaining players can continue without broken state.

### Why this matters

Player elimination is one of the most complex multiplayer interactions. When a player loses, the engine must clean up all of their game objects, cancel their spells and abilities, and remove them from all future game decisions. Getting this wrong causes crashes, phantom permanents, and stuck game states.

### Key changes

- When a player loses (life, poison, commander damage, concession, or deck-out):
  - remove all permanents they own from the battlefield (fire LTB/dies triggers as appropriate);
  - remove all spells and abilities they control from the stack;
  - exile all cards they own in other players' zones;
  - end all emblems and continuous effects they control;
  - remove them from combat (as attacker, defender, or blocker);
  - remove them from the turn order and priority rotation;
  - remove them from all pending choice and trigger queues;
  - handle "owner leaves" for tokens they own (tokens cease to exist).
- Ensure the game continues cleanly with remaining players.
- Handle the case where elimination causes cascading eliminations (e.g., a player's Blood Artist dies, draining another player to zero).
- The game ends when only one player remains.

### Candidate files

- `src/engine/GameEngine.ts`
- `src/engine/GameState.ts`
- `src/engine/ZoneManager.ts`
- `src/engine/CombatManager.ts`
- `src/engine/StackManager.ts`
- `src/engine/TurnManager.ts`

### Exit criteria

- A player who loses has all their game objects cleaned up.
- Remaining players' game state is consistent after elimination.
- Tests cover at least:
  - player eliminated during combat (as attacker and defender);
  - player eliminated during stack resolution;
  - cascading eliminations from LTB/dies triggers;
  - game ending when only one player remains.

## Milestone 4: Static Abilities, Replacement Effects, and Rule-Modifying Effects

### Objective

Turn static abilities and replacement effects into active engine behavior with full rules coverage.

### Why this matters

The current card model can define static abilities, but the engine does not yet have a full pass that turns those definitions into live restrictions, prevention effects, replacement effects, and cost modifications. Replacement effects in particular are central to Commander (commander zone replacement, damage prevention, "if you would draw" effects).

### Key changes

- Add a static-ability collection phase over battlefield and relevant command-zone objects.
- Compile static abilities into active effect records each game loop.
- Support at minimum:
  - attack restrictions;
  - block restrictions;
  - pump and anthem effects;
  - granted keywords;
  - cost modifications;
  - "can't be targeted" style effects.
- Build a full replacement effect system:
  - replacement effect registration and matching;
  - player-chooses-order when multiple replacement effects apply to the same event;
  - self-replacement effects (applied before other replacements);
  - prevention effects and prevention shields;
  - "can't be prevented" overrides (e.g., "damage can't be prevented");
  - interaction with commander zone replacement (which is itself a replacement effect).
- Ensure effect lifetimes and dependencies are recomputed safely when the board changes.

### Candidate files

- `src/engine/ContinuousEffects.ts`
- `src/engine/GameEngine.ts`
- `src/engine/types.ts`
- `src/engine/EventBus.ts`

### Exit criteria

- `Propaganda` and `Ghostly Prison` function through generic engine rules, not card-specific hacks.
- At least one static anthem effect and one static keyword-granting effect are covered by tests.
- Replacement effects apply in player-chosen order when multiple apply.
- Prevention effects and "can't be prevented" overrides work correctly.

## Milestone 5: Equipment, Auras, and Attachment System

### Objective

Make equipment, auras, and attachment mechanics a proper engine subsystem.

### Why this matters

Equipment and auras are fundamental to Commander decks. Swiftfoot Boots, Lightning Greaves, Swords, and aura-based removal (Pacifism, Darksteel Mutation) are format staples. The engine needs first-class attach, detach, equip, and aura-targeting rules.

### Key changes

- Implement equip as an activated ability with sorcery-speed timing and a mana cost.
- Support reconfigure (equip variant) if those cards are in scope.
- Implement aura targeting on cast (aura goes on stack targeting a legal permanent).
- Implement aura attachment on resolution (attaches to target; fizzles if target is illegal).
- Implement aura state-based falloff (aura goes to graveyard if attached permanent leaves or aura is no longer legally attached).
- Handle "enchant [quality]" restrictions (enchant creature, enchant land, etc.).
- Handle "equip [quality]" restrictions (equip only creatures you control, etc.).
- Ensure attachments detach correctly when the equipped/enchanted permanent leaves the battlefield.
- Support bestow (cast as aura or creature).
- Ensure totem armor, umbra armor, and similar "instead of being destroyed" replacement effects integrate with the replacement effect system from M4.

### Candidate files

- `src/engine/GameEngine.ts`
- `src/engine/ZoneManager.ts`
- `src/engine/StateBasedActions.ts`
- `src/engine/types.ts`
- `src/cards/CardBuilder.ts`

### Exit criteria

- Equip and aura attachment work through engine rules.
- Auras fizzle when their target becomes illegal.
- Auras fall off when their attached permanent leaves.
- Equipment persists on the battlefield when the equipped creature leaves.
- Tests cover at least:
  - equip cost payment and timing;
  - aura cast targeting and resolution;
  - aura falloff on creature death;
  - Swiftfoot Boots granting hexproof and haste.

## Milestone 6: Multiplayer Combat Legality and Goad

### Objective

Make combat rules correct for Commander multiplayer, including the goad mechanic.

### Key changes

- Expand attack declarations so attackers can choose valid defender objects, not just players.
- Support attacking planeswalkers as a first-class combat target.
- Add explicit attack-cost and attack-restriction hooks to combat validation.
- Implement goad as a full engine mechanic:
  - track goaded status per creature (with source tracking for "goaded by player X");
  - goaded creatures must attack each combat if able;
  - goaded creatures can't attack the player who goaded them;
  - goad interacts correctly with other attack restrictions (Propaganda tax still applies);
  - goad wears off at the goading player's next turn.
- Ensure eliminated players are removed from legal defender sets at the right time.
- Decide whether battles are in the first Commander milestone or deferred.

### Candidate files

- `src/engine/CombatManager.ts`
- `src/engine/types.ts`
- `src/engine/GameEngine.ts`
- `src/ui/**` as needed for combat selection

### Exit criteria

- Combat target selection is correct in multiplayer Commander.
- Attack taxes and "must attack / can't attack" restrictions are enforced before declaration.
- Goad forces attacks at correct targets and wears off at the right time.
- Tests cover:
  - Propaganda and Ghostly Prison;
  - attacking a planeswalker;
  - goaded creature attack requirements and restrictions;
  - goad interaction with Propaganda-style taxes.

## Milestone 7: Combat Damage Correctness and Regeneration

### Objective

Replace the simplified combat-damage flow with a Commander-safe one, and add regeneration support.

### Key changes

- Insert a real first-strike combat damage step instead of resolving both passes inside one transition.
- Track deathtouch lethal damage explicitly.
- Let the defending player choose blocker assignment order where required.
- Let the attacking player assign damage across ordered blockers correctly.
- Apply trample over ordered blockers using the right lethal threshold.
- Keep protection and damage prevention integrated with combat damage.
- Confirm monarch transfer timing against combat damage.
- Implement regeneration:
  - regeneration shields (created by regeneration abilities);
  - when a permanent with a regeneration shield would be destroyed, instead tap it, remove it from combat, remove all damage, and remove one shield;
  - regeneration does not prevent sacrifice;
  - regeneration does not prevent "exile" or "-X/-X lethal" state-based death;
  - "can't be regenerated" effects override regeneration shields.

### Candidate files

- `src/engine/TurnManager.ts`
- `src/engine/GameEngine.ts`
- `src/engine/CombatManager.ts`
- `src/engine/StateBasedActions.ts`

### Exit criteria

- First strike, double strike, deathtouch, trample, menace, vigilance, lifelink, and protection all pass regression tests.
- Damage assignment is player-choice-driven where rules require it.
- Regeneration shields prevent destruction correctly and interact with "can't be regenerated".

## Milestone 8: Stack Resolution, Spell Copying, and Target Legality

### Objective

Make target legality and spell resolution rules robust enough for Commander staples, and support spell copying.

### Key changes

- Revalidate targets on resolution against the original target spec, not just object existence.
- Use object identity plus zone-change data so a moved-and-returned permanent is not still treated as the same target.
- Re-check shroud, hexproof, ward, and protection at resolution where applicable.
- Fix modal targeting so target specs come from the chosen mode, not mode zero.
- Add support for split second if those cards are in target Commander scope.
- Implement spell copying as a first-class stack operation:
  - copy a spell on the stack (Fork, Twincast, Narset's Reversal);
  - copies preserve X values, modes, and targets (but the copier may choose new targets);
  - copies are not "cast" (don't trigger "when you cast" abilities);
  - copies resolve independently and fizzle independently;
  - support "copy the next spell you cast" delayed copy effects.

### Candidate files

- `src/engine/StackManager.ts`
- `src/engine/GameEngine.ts`
- `src/engine/types.ts`

### Exit criteria

- Single-target and multi-target spells fizzle correctly.
- Modal spells validate the chosen mode's targets.
- Ward, protection, and retargeting edge cases are covered by tests.
- Spell copies resolve with correct targets, modes, and X values.
- Tests cover at least:
  - Fork copying a spell with new targets;
  - copied spell fizzling independently of original;
  - split second preventing responses.

## Milestone 9: Mana, Costs, Hybrid/Phyrexian Mana, and Color Identity

### Objective

Replace text-based mana heuristics with explicit mana-production semantics, and add full cost type support.

### Why this matters

Commander games rely heavily on rocks, dorks, treasures, alternate costs, and tax effects. A heuristic parser over ability text will not scale safely. Commander also has specific rules about color identity and mana production that must be engine-enforced.

### Key changes

- Add explicit mana-production metadata to mana abilities.
- Refactor autotap into a solver that can use:
  - lands;
  - mana rocks;
  - mana dorks;
  - treasures and similar disposable sources.
- Model commander tax, additional costs, reductions, and alternate costs through shared cost objects.
- Implement cost modification ordering per MTG rules:
  - apply additional costs and cost increases first;
  - apply cost reductions second;
  - apply Trinisphere-style minimum floors last.
- Support Commander-relevant payment helpers for:
  - convoke (tap creatures to pay);
  - delve (exile from graveyard to pay generic);
  - ward payments;
  - "unless they pay" patterns.
- Ensure the solver can respect color constraints and colorless-only costs.
- Add hybrid mana cost support:
  - parse `{W/U}`, `{2/W}`, and similar hybrid symbols;
  - hybrid mana contributes all component colors to color identity;
  - solver chooses optimal payment for hybrid costs.
- Add phyrexian mana cost support:
  - parse `{W/P}` and similar phyrexian symbols;
  - player chooses mana or 2 life for each phyrexian symbol;
  - phyrexian mana contributes its color to color identity.
- Enforce the Commander color identity mana production rule:
  - if an effect would produce mana of a color outside the player's commander's color identity, it produces colorless instead.

### Candidate files

- `src/engine/ManaManager.ts`
- `src/engine/types.ts`
- `src/engine/GameEngine.ts`
- `src/cards/CardBuilder.ts`

### Exit criteria

- Commander recasts with tax work correctly under multicolor and colorless constraints.
- Treasures, rocks, and dorks participate in cost payment.
- Cost increases and reductions interact correctly (Thalia + Medallion).
- Hybrid mana symbols can be paid with either color.
- Phyrexian mana symbols can be paid with life.
- Off-identity mana production produces colorless.
- There are deterministic tests for at least:
  - commander tax;
  - treasure usage;
  - convoke;
  - delve;
  - hybrid mana payment;
  - phyrexian mana payment;
  - off-identity mana production.

## Milestone 10: Trigger Engine, Delayed Triggers, and Sacrifice

### Objective

Support the trigger patterns and sacrifice mechanics that show up repeatedly in Commander decks.

### Key changes

- Add same-controller trigger ordering choices.
- Implement delayed triggered abilities as a first-class concept:
  - "at the beginning of the next end step" (one-shot, fires once);
  - "at the beginning of your next upkeep" (one-shot);
  - "when you next cast a spell" (one-shot, condition-based);
  - recurring delayed triggers that persist until removed;
  - delayed triggers track their source and controller correctly.
- Add reflexive trigger support ("when you do" patterns).
- Ensure dies and leave-the-battlefield triggers use LKI correctly.
- Add a reusable payment-choice pattern for:
  - Rhystic Study;
  - Smothering Tithe;
  - similar "unless that player pays" cards.
- Build sacrifice as a shared engine primitive:
  - sacrifice as a cost (Viscera Seer, Ashnod's Altar) — cannot be responded to;
  - sacrifice as an effect (edict effects, Fleshbag Marauder) — player chooses what to sacrifice;
  - "each player sacrifices" (Grave Pact, Dictate of Erebos);
  - sacrifice cannot be prevented by regeneration or indestructible;
  - sacrifice fires "dies" triggers and "leaves the battlefield" triggers.
- Add richer event batching only if needed for simultaneous multiplayer scenarios.

### Candidate files

- `src/engine/EventBus.ts`
- `src/engine/GameEngine.ts`
- `src/engine/StackManager.ts`
- `src/engine/types.ts`

### Exit criteria

- Rhystic Study, Smothering Tithe, Blood Artist, Talrand, and Sylvan Library all use shared engine behavior rather than custom approximations.
- APNAP plus same-controller ordering choices are test-covered.
- Delayed triggers fire at the correct time and clean up after one-shot execution.
- Sacrifice as cost and sacrifice as effect both work correctly.
- Tests cover at least:
  - "at the beginning of the next end step" delayed trigger;
  - reflexive trigger from a payment;
  - Grave Pact-style "each player sacrifices" chain;
  - sacrifice as cost vs sacrifice as effect distinction.

## Milestone 11: Token Types, Library Search, and Player Choices

### Objective

Add predefined token types, library search mechanics, and a general player-choice framework for Commander staple interactions.

### Why this matters

Tutors and fetchlands are the most-played card categories in Commander. Treasure tokens are ubiquitous. Many Commander cards require structured player choices (choose a creature type, choose an opponent, vote). Without engine support for these, card coverage stalls.

### Key changes

- Add predefined token type definitions:
  - Treasure (artifact, sacrifice for one mana of any color);
  - Clue (artifact, pay 2 and sacrifice to draw a card);
  - Food (artifact, pay 2 and sacrifice to gain 3 life);
  - Blood (artifact, pay 1, discard, and sacrifice to draw a card);
  - ensure all predefined tokens have the correct types, abilities, and costs.
- Implement library search as an engine primitive:
  - reveal library contents to the searching player (not opponents unless specified);
  - apply a filter predicate (card type, CMC, name, etc.);
  - present matching cards for player selection;
  - support "fail to find" for searches that don't say "reveal" or have optional results;
  - move selected card(s) to the destination zone (hand, battlefield, top of library, etc.);
  - shuffle library after search (unless the effect says otherwise);
  - support searching opponent libraries when effects require it.
- Build a general player-choice framework:
  - "choose a creature type" (Kindred Discovery, Vanquisher's Banner);
  - "choose a color" (various protection and prevention effects);
  - "choose an opponent" (common multiplayer targeting);
  - "choose one or more" (modal with variable choice count);
  - voting mechanics (Council's Dilemma, Will of the Council):
    - each player votes in APNAP order;
    - tally votes and execute based on outcome;
    - support "vote for" and "vote against" patterns.
- Implement cleanup step discard as a player choice:
  - player chooses which cards to discard down to hand size;
  - respect "no maximum hand size" effects (Reliquary Tower, Thought Vessel).

### Candidate files

- `src/engine/GameEngine.ts`
- `src/engine/ZoneManager.ts`
- `src/engine/types.ts`
- `src/engine/TurnManager.ts`
- `src/cards/CardBuilder.ts`

### Exit criteria

- Treasure tokens can be created and sacrificed for mana.
- Tutors can search libraries and present choices to players.
- Player choice framework supports creature type, color, and opponent selection.
- Cleanup discard is player-driven, not automatic.
- Tests cover at least:
  - Treasure token creation and sacrifice;
  - Demonic Tutor searching library;
  - fetchland searching for a basic land type;
  - "choose a creature type" selection;
  - voting resolution in multiplayer.

## Milestone 12: Common Keyword Mechanics

### Objective

Implement the keyword mechanics that appear most frequently across Commander staple cards.

### Why this matters

Many Commander staples use keyword mechanics that require engine support beyond a simple boolean flag. These mechanics modify how spells are cast, how costs are paid, or how effects resolve.

### Key changes

- Implement kicker and multikicker:
  - optional additional cost paid during casting;
  - kicker status tracked on the stack entry;
  - effects check "if this spell was kicked" to branch behavior;
  - multikicker allows paying the kicker cost any number of times.
- Implement cascade:
  - triggered ability that fires on cast;
  - exile cards from library until a card with lower mana value is found;
  - cast the found card for free (without paying its mana cost);
  - put remaining exiled cards on the bottom in a random order;
  - cascade can chain (a cascaded spell with cascade triggers again).
- Implement cycling:
  - activated ability from hand;
  - pay cycling cost, discard the card, draw a card;
  - support typed cycling (e.g., "basic landcycling" searches instead of drawing);
  - cycling triggers fire on the discard.
- Implement overload:
  - alternative cost that changes "target" to "each" in the effect text;
  - overload status tracked on the stack entry;
  - effect resolution branches on overload status;
  - Cyclonic Rift is the primary test case.
- Implement storm:
  - triggered ability that fires on cast;
  - counts spells cast before this one in the current turn;
  - creates that many copies of the spell on the stack;
  - copies may choose new targets.
- Implement flashback as a full mechanic:
  - cast from graveyard for flashback cost;
  - exile the card after resolution or if it would leave the stack;
  - flashback interacts with commander tax if the commander has flashback.
- Implement landfall as a named trigger pattern:
  - triggers when a land enters the battlefield under your control;
  - supports "whenever a land enters the battlefield under your control" pattern;
  - first-class event type for reliable matching.

### Candidate files

- `src/engine/StackManager.ts`
- `src/engine/GameEngine.ts`
- `src/engine/EventBus.ts`
- `src/engine/types.ts`
- `src/cards/CardBuilder.ts`

### Exit criteria

- Kicker, cascade, cycling, overload, storm, flashback, and landfall all work through shared engine primitives.
- Tests cover at least:
  - kicked vs non-kicked spell resolution;
  - cascade chain finding and casting;
  - Cyclonic Rift in normal and overload modes;
  - storm copy count and target selection;
  - flashback casting and exile;
  - landfall triggering on land entry.

## Milestone 13: Commander-Specific Shared Systems

### Objective

Finish the Commander-only global systems that are worth making first-class.

### Key changes

- Keep and harden monarch support.
- Add initiative if those cards are in product scope.
- Encode the Commander mulligan policy explicitly (free mulligan, then London mulligan with bottom).
- Implement extra turns:
  - add a `pendingExtraTurns` queue to game state;
  - extra turns are inserted after the current turn (most recent grant goes first);
  - support "extra turn after this one" (Time Warp) and "X extra turns" (Time Stretch);
  - extra turns taken by eliminated players are skipped;
  - extra turns interact correctly with turn order (only the granted player takes the turn).
- Implement "end the turn" effects:
  - Time Stop, Sundial of the Infinite, and similar effects;
  - exile all spells and abilities on the stack;
  - discard down to hand size;
  - clear all combat;
  - advance directly to the cleanup step;
  - triggers that fire during cleanup create a new cleanup step.
- Add experience counters as a player-level counter type:
  - tracked per player, not per permanent;
  - persist across turns (unlike mana);
  - support "you get an experience counter" effects;
  - support "for each experience counter you have" scaling.
- Add energy counters as a player-level counter type:
  - tracked per player;
  - persist across turns;
  - support payment of energy as a cost.
- Add any additional command-zone designations only when cards require them.

### Candidate files

- `src/engine/GameState.ts`
- `src/engine/TurnManager.ts`
- `src/engine/GameEngine.ts`
- `src/engine/StackManager.ts`
- `src/engine/types.ts`

### Exit criteria

- Monarch and, if included, initiative are deterministic and test-covered.
- Opening-hand flow matches the intended Commander mulligan rules.
- Extra turns queue and resolve in the correct order.
- "End the turn" clears the stack and advances to cleanup.
- Experience and energy counters persist and can be spent.
- Tests cover at least:
  - extra turn ordering when multiple are granted;
  - extra turn skip for eliminated player;
  - Time Stop ending the turn mid-stack;
  - experience counter accumulation and scaling;
  - Commander mulligan policy.

## Suggested PR Sequence

1. `test:engine` harness and first failing regression tests
2. identity, zone-change counters, and LKI
3. commander zone-change rules, commander damage model, and partner commanders
4. player elimination and multiplayer cleanup
5. static abilities, replacement effects, and rule-modifying framework
6. equipment, auras, and attachment system
7. multiplayer combat legality and goad
8. combat damage correctness and regeneration
9. stack resolution, spell copying, and target legality fixes
10. mana-production, cost solver, hybrid/phyrexian mana, and color identity rules
11. trigger engine upgrades, delayed triggers, sacrifice system, and staple-card rewrites
12. token types, library search, player choices, and cleanup discard
13. common keyword mechanics (kicker, cascade, cycling, overload, storm, flashback, landfall)
14. extra turns, end the turn, monarch, initiative, mulligan, experience/energy counters, and cleanup passes

## First Commander Card Pack to Validate Against

Use a small set of Commander staples as the acceptance surface for the engine:

- Talrand, Sky Summoner
- Rhystic Study
- Smothering Tithe
- Blood Artist
- Swiftfoot Boots
- Sol Ring
- Command Tower
- Ghostly Prison
- Propaganda
- Sylvan Library
- Demonic Tutor
- Evolving Wilds
- Cyclonic Rift
- Swords to Plowshares
- Grave Pact
- Ashnod's Altar
- Rite of Replication
- Maelstrom Wanderer
- Thalia, Guardian of Thraben

These cards touch:

- trigger timing;
- commander tax and mana acceleration;
- ward and targeting;
- attack taxes;
- card draw choices;
- multiplayer life changes;
- token creation;
- library search and shuffle;
- sacrifice as cost and effect;
- spell copying;
- cascade;
- kicker;
- overload;
- cost modification interaction;
- equipment attachment.

## Definition of Done for the Commander Baseline

The Commander engine baseline is complete when:

- commanders move between zones correctly and preserve tax and damage state;
- partner commanders are supported with independent tax and damage tracking;
- player elimination cleans up all game objects and the game continues correctly;
- multiplayer combat is legal and deterministic, including goad;
- common Commander static abilities and taxes are enforced by engine rules;
- replacement effects apply in correct order with player choice;
- equipment and auras attach, detach, and fall off correctly;
- target legality is rechecked correctly at resolution;
- spell copying works with correct target, mode, and X value preservation;
- mana and cost payment are explicit and not text-inferred;
- hybrid and phyrexian mana costs are supported;
- color identity mana production rule is enforced;
- cost increases and reductions interact in the correct order;
- common Commander staple cards run through shared primitives;
- delayed triggers, sacrifice, and "unless pays" patterns are engine-driven;
- library search, token types, and player choices are engine primitives;
- common keyword mechanics (kicker, cascade, cycling, overload, storm, flashback, landfall) work;
- extra turns and "end the turn" effects are supported;
- experience and energy counters are tracked and spendable;
- there is an engine regression suite for all of the above.

At that point, expanding the Commander card pool becomes a content problem instead of a core engine problem.
