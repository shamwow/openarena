import React, { useCallback, useMemo, useState } from 'react';
import type { CardInstance, PlayerAction } from '../../engine/types';
import type { DragCardPayload } from '../types';
import { getTestGameState } from '../../testing/testGameStates';
import { HandRail } from './HandRail';

const EMPTY_CARDS: CardInstance[] = [];
const EMPTY_ACTIONS: PlayerAction[] = [];

function noopAction(action: PlayerAction): void {
  void action;
}

function noopDragStart(payload: DragCardPayload): void {
  void payload;
}

function noopDragEnd(): void {}

function noopRegisterCardElement(cardId: string, node: HTMLDivElement | null): void {
  void cardId;
  void node;
}

function noopRegisterZoneAnchor(key: string, node: HTMLElement | null): void {
  void key;
  void node;
}

function getQueryParam(name: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get(name)?.trim();
  return value ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getInitialCardCount(maxCards: number): number {
  const raw = Number.parseInt(getQueryParam('count') ?? '', 10);
  if (Number.isNaN(raw)) {
    return maxCards;
  }

  return clamp(raw, 0, maxCards);
}

function getInitialHiddenFlag(): boolean {
  const value = getQueryParam('hidden');
  return value === '1' || value === 'true';
}

function getInitialPreviewMode(): 'hover' | 'tap' {
  return getQueryParam('preview') === 'tap' ? 'tap' : 'hover';
}

export const HandRailTestPage: React.FC = () => {
  const initialState = useMemo(() => getTestGameState('big-hand')?.build() ?? null, []);
  const allCards = initialState?.zones.player1.HAND ?? EMPTY_CARDS;
  const maxCards = 100;
  const [cardCount, setCardCount] = useState(() => getInitialCardCount(maxCards));
  const [handHidden, setHandHidden] = useState(() => getInitialHiddenFlag());
  const [previewMode, setPreviewMode] = useState<'hover' | 'tap'>(() => getInitialPreviewMode());
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);

  const visibleCards = useMemo(
    () => allCards.slice(0, clamp(cardCount, 0, maxCards)),
    [allCards, cardCount, maxCards],
  );

  const previewedCard = useMemo(
    () => visibleCards.find((card) => card.objectId === previewCardId) ?? null,
    [previewCardId, visibleCards],
  );

  const handlePreview = useCallback((card: CardInstance) => {
    setPreviewCardId(card.objectId);
  }, []);

  const handlePreviewClear = useCallback((cardId?: string) => {
    setPreviewCardId((current) => {
      if (!current) {
        return current;
      }

      if (cardId && current !== cardId) {
        return current;
      }

      return null;
    });
  }, []);

  if (!initialState) {
    return (
      <main className="arena-hand-rail-test-page">
        <section className="arena-hand-rail-test-panel">
          <div className="arena-hand-rail-test-title">Hand Rail Test Page</div>
          <div className="arena-preview__meta">Missing `big-hand` test fixture.</div>
        </section>
      </main>
    );
  }

  return (
    <main className="arena-hand-rail-test-page">
      <section className="arena-hand-rail-test-panel">
        <div>
          <div className="arena-hand-rail-test-title">Hand Rail Test Page</div>
          <div className="arena-preview__meta">
            Dev-only route for isolating hand rail rendering. Use `?test-page=hand-rail` with
            optional `&count=80`, `&hidden=1`, or `&preview=tap`.
          </div>
        </div>

        <div className="arena-hand-rail-test-controls">
          <label className="arena-hand-rail-test-control">
            <span>Visible cards</span>
            <input
              type="range"
              min="0"
              max={maxCards}
              value={cardCount}
              onChange={(event) => setCardCount(clamp(Number(event.target.value), 0, maxCards))}
            />
          </label>

          <label className="arena-hand-rail-test-control">
            <span>Card count</span>
            <input
              type="number"
              min="0"
              max={maxCards}
              value={cardCount}
              onChange={(event) => {
                const nextValue = Number.parseInt(event.target.value, 10);
                setCardCount(Number.isNaN(nextValue) ? 0 : clamp(nextValue, 0, maxCards));
              }}
            />
          </label>

          <label className="arena-hand-rail-test-check">
            <input
              type="checkbox"
              checked={handHidden}
              onChange={(event) => setHandHidden(event.target.checked)}
            />
            <span>Hidden hand</span>
          </label>

          <label className="arena-hand-rail-test-check">
            <input
              type="checkbox"
              checked={previewMode === 'tap'}
              onChange={(event) => setPreviewMode(event.target.checked ? 'tap' : 'hover')}
            />
            <span>Tap preview</span>
          </label>
        </div>

        <div className="arena-hand-rail-test-stats">
          <span className="arena-pill">
            Showing <strong>{visibleCards.length}</strong> of <strong>{maxCards}</strong>
          </span>
          <span className="arena-pill">
            Preview <strong>{previewedCard?.definition.name ?? 'None'}</strong>
          </span>
        </div>
      </section>

      <section className="arena-hand-rail-test-stage">
        <HandRail
          playerId="player1"
          playerName={initialState.players.player1.name}
          handHidden={handHidden}
          command={EMPTY_CARDS}
          hand={visibleCards}
          exile={EMPTY_CARDS}
          graveyard={EMPTY_CARDS}
          legalActions={EMPTY_ACTIONS}
          previewCardId={previewCardId}
          previewMode={previewMode}
          draggingCardId={null}
          onAction={noopAction}
          onPreview={handlePreview}
          onPreviewClear={handlePreviewClear}
          onDragStart={noopDragStart}
          onDragEnd={noopDragEnd}
          registerCardElement={noopRegisterCardElement}
          registerZoneAnchor={noopRegisterZoneAnchor}
        />
      </section>
    </main>
  );
};
