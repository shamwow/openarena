import type { CardInstance } from '../../engine/types';
import { CardType } from '../../engine/types';

export type BattlefieldGroupKey = 'top' | 'bottom';

export interface BattlefieldGroup {
  key: BattlefieldGroupKey;
  title: string;
  cards: CardInstance[];
}

function isEquipment(card: CardInstance): boolean {
  return card.definition.subtypes.includes('Equipment');
}

function isSaga(card: CardInstance): boolean {
  return card.definition.subtypes.includes('Saga');
}

function isEquippedEquipment(card: CardInstance): boolean {
  return isEquipment(card) && card.attachedTo != null;
}

function isTopRowCard(card: CardInstance): boolean {
  const { types } = card.definition;

  if (types.includes(CardType.CREATURE)) {
    return true;
  }

  if (types.includes(CardType.PLANESWALKER)) {
    return true;
  }

  if (isSaga(card)) {
    return true;
  }

  if (types.includes(CardType.ENCHANTMENT)) {
    return true;
  }

  if (isEquippedEquipment(card)) {
    return true;
  }

  if (types.includes(CardType.BATTLE)) {
    return true;
  }

  return false;
}

function compareTopRowCards(left: CardInstance, right: CardInstance): number {
  const leftIsCreature = left.definition.types.includes(CardType.CREATURE);
  const rightIsCreature = right.definition.types.includes(CardType.CREATURE);

  if (leftIsCreature !== rightIsCreature) {
    return leftIsCreature ? -1 : 1;
  }

  const leftIsPlaneswalker = left.definition.types.includes(CardType.PLANESWALKER);
  const rightIsPlaneswalker = right.definition.types.includes(CardType.PLANESWALKER);
  if (leftIsPlaneswalker !== rightIsPlaneswalker) {
    return leftIsPlaneswalker ? -1 : 1;
  }

  const leftIsSaga = isSaga(left);
  const rightIsSaga = isSaga(right);
  if (leftIsSaga !== rightIsSaga) {
    return leftIsSaga ? -1 : 1;
  }

  const leftIsEnchantment = left.definition.types.includes(CardType.ENCHANTMENT);
  const rightIsEnchantment = right.definition.types.includes(CardType.ENCHANTMENT);
  if (leftIsEnchantment !== rightIsEnchantment) {
    return leftIsEnchantment ? -1 : 1;
  }

  return left.timestamp - right.timestamp;
}

function compareBottomRowCards(left: CardInstance, right: CardInstance): number {
  const leftIsLand = left.definition.types.includes(CardType.LAND);
  const rightIsLand = right.definition.types.includes(CardType.LAND);

  if (leftIsLand !== rightIsLand) {
    return leftIsLand ? -1 : 1;
  }

  const leftIsUnequippedEquipment = isEquipment(left) && left.attachedTo == null;
  const rightIsUnequippedEquipment = isEquipment(right) && right.attachedTo == null;
  if (leftIsUnequippedEquipment !== rightIsUnequippedEquipment) {
    return leftIsUnequippedEquipment ? -1 : 1;
  }

  const leftIsArtifact = left.definition.types.includes(CardType.ARTIFACT);
  const rightIsArtifact = right.definition.types.includes(CardType.ARTIFACT);
  if (leftIsArtifact !== rightIsArtifact) {
    return leftIsArtifact ? -1 : 1;
  }

  return left.timestamp - right.timestamp;
}

export function getBattlefieldGroups(cards: CardInstance[]): BattlefieldGroup[] {
  const topCards: CardInstance[] = [];
  const bottomCards: CardInstance[] = [];

  for (const card of cards) {
    if (isTopRowCard(card)) {
      topCards.push(card);
      continue;
    }

    bottomCards.push(card);
  }

  topCards.sort(compareTopRowCards);
  bottomCards.sort(compareBottomRowCards);

  const groups: BattlefieldGroup[] = [
    { key: 'top', title: 'Top Row', cards: topCards },
    { key: 'bottom', title: 'Bottom Row', cards: bottomCards },
  ];

  return groups.filter((group) => group.cards.length > 0);
}
