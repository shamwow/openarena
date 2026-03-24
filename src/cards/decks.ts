import type { CardDefinition } from '../engine/types';
import type { DeckConfig } from '../engine/GameState';
import * as Cards from './sets/starter/index';

function repeat(card: CardDefinition, n: number): CardDefinition[] {
  return Array(n).fill(card);
}

/** White deck — Heliod lifegain */
export const whiteDeck: DeckConfig = {
  commander: Cards.HeliodSunCrowned,
  playerName: 'White Player',
  cards: [
    ...repeat(Cards.Plains, 36),
    Cards.CommandTower,
    Cards.ReliquaryTower,
    Cards.SolRing,
    Cards.ArcaneSignet,
    Cards.MindStone,
    Cards.CommandersSphere,
    Cards.ThoughtVessel,
    Cards.LightningGreaves,
    Cards.SwiftfootBoots,
    Cards.SerraAngel,
    Cards.SerraAngel,
    Cards.SunTitan,
    Cards.SoldiersOfTheWatch,
    Cards.SoldiersOfTheWatch,
    Cards.SolemnSimulacrum,
    Cards.SwordsToPlowshares,
    Cards.PathToExile,
    Cards.WrathOfGod,
    Cards.Disenchant,
    Cards.Disenchant,
    Cards.GhostlyPrison,
    ...repeat(Cards.Plains, 17),
  ].slice(0, 99), // 99 cards + commander = 100
};

/** Blue deck — Talrand spellslinger */
export const blueDeck: DeckConfig = {
  commander: Cards.TalrandSkySummoner,
  playerName: 'Blue Player',
  cards: [
    ...repeat(Cards.Island, 36),
    Cards.CommandTower,
    Cards.ReliquaryTower,
    Cards.SolRing,
    Cards.ArcaneSignet,
    Cards.MindStone,
    Cards.CommandersSphere,
    Cards.ThoughtVessel,
    Cards.LightningGreaves,
    Cards.AirElemental,
    Cards.AirElemental,
    Cards.Mulldrifter,
    Cards.Mulldrifter,
    Cards.SolemnSimulacrum,
    Cards.Counterspell,
    Cards.Counterspell,
    Cards.BrainstormCard,
    Cards.BrainstormCard,
    Cards.Ponder,
    Cards.Ponder,
    Cards.RhysticStudy,
    Cards.Propaganda,
    ...repeat(Cards.Island, 17),
  ].slice(0, 99),
};

/** Black deck — Ayara aristocrats */
export const blackDeck: DeckConfig = {
  commander: Cards.AyaraFirstOfLocthwain,
  playerName: 'Black Player',
  cards: [
    ...repeat(Cards.Swamp, 36),
    Cards.CommandTower,
    Cards.ReliquaryTower,
    Cards.SolRing,
    Cards.ArcaneSignet,
    Cards.MindStone,
    Cards.CommandersSphere,
    Cards.ThoughtVessel,
    Cards.LightningGreaves,
    Cards.GraveTitan,
    Cards.BloodArtist,
    Cards.BloodArtist,
    Cards.SolemnSimulacrum,
    Cards.DoomBlade,
    Cards.DoomBlade,
    Cards.SignInBlood,
    Cards.SignInBlood,
    Cards.Damnation,
    ...repeat(Cards.Swamp, 21),
  ].slice(0, 99),
};

/** Red deck — Krenko goblins */
export const redDeck: DeckConfig = {
  commander: Cards.KrenkoMobBoss,
  playerName: 'Red Player',
  cards: [
    ...repeat(Cards.Mountain, 36),
    Cards.CommandTower,
    Cards.ReliquaryTower,
    Cards.SolRing,
    Cards.ArcaneSignet,
    Cards.MindStone,
    Cards.CommandersSphere,
    Cards.ThoughtVessel,
    Cards.LightningGreaves,
    Cards.SwiftfootBoots,
    Cards.ShivanDragon,
    Cards.GoblinGuide,
    Cards.GoblinGuide,
    Cards.InfernalPlunge,
    Cards.SolemnSimulacrum,
    Cards.LightningBolt,
    Cards.LightningBolt,
    Cards.LightningBolt,
    Cards.Chaos_Warp,
    ...repeat(Cards.Mountain, 20),
  ].slice(0, 99),
};

export const prebuiltDecks: DeckConfig[] = [whiteDeck, blueDeck, blackDeck, redDeck];
