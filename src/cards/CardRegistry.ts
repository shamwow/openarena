import type { CardDefinition } from '../engine/types';

class CardRegistryImpl {
  private cards: Map<string, CardDefinition> = new Map();

  register(card: CardDefinition): void {
    this.cards.set(card.id, card);
  }

  registerAll(cards: CardDefinition[]): void {
    for (const card of cards) {
      this.register(card);
    }
  }

  get(id: string): CardDefinition | undefined {
    return this.cards.get(id);
  }

  getByName(name: string): CardDefinition | undefined {
    for (const card of this.cards.values()) {
      if (card.name === name) return card;
    }
    return undefined;
  }

  getAll(): CardDefinition[] {
    return Array.from(this.cards.values());
  }

  has(id: string): boolean {
    return this.cards.has(id);
  }
}

export const CardRegistry = new CardRegistryImpl();

// Auto-register all starter cards
import * as StarterCards from './sets/starter/index';

const allCards = Object.values(StarterCards).filter(
  (v): v is CardDefinition => typeof v === 'object' && v !== null && 'id' in v && 'name' in v
);
CardRegistry.registerAll(allCards);
