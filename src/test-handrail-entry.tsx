import React, { useRef, useLayoutEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import './ui/arena-theme.css';

const CARD_COUNT = 100;

const HOVER_TIERS = [
  { scale: 1.24, lift: 24 },
  { scale: 1.12, lift: 14 },
  { scale: 1.05, lift: 6 },
];
const HOVER_RADIUS = HOVER_TIERS.length;

function applyCardStyle(wrapper: HTMLElement, scale: number, lift: number, zIndex: number) {
  const cardEl = wrapper.querySelector('[data-variant="hand"]') as HTMLElement | null;
  if (!cardEl) return;
  cardEl.style.setProperty('--card-scale', `${scale}`);
  cardEl.style.setProperty('--card-lift', `${lift}px`);
  wrapper.style.zIndex = `${zIndex}`;
}

function resetCardStyle(wrapper: HTMLElement, baseIndex: number) {
  const cardEl = wrapper.querySelector('[data-variant="hand"]') as HTMLElement | null;
  if (!cardEl) return;
  cardEl.style.removeProperty('--card-scale');
  cardEl.style.removeProperty('--card-lift');
  wrapper.style.zIndex = `${baseIndex}`;
}

/**
 * Isolated hand rail test page.
 * Renders CARD_COUNT cards using the exact same DOM structure and CSS classes
 * as the real HandRail, but with zero game engine, CardView, or preview logic.
 * This isolates the hover animation performance.
 */
function TestHandRail() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const handCardsRef = useRef<HTMLDivElement>(null);
  const hoveredHandIndexRef = useRef<number | null>(null);

  // Dynamic overlap
  useLayoutEffect(() => {
    const scrollEl = scrollRef.current;
    const handCardsEl = handCardsRef.current;
    if (!scrollEl || !handCardsEl) return;

    const update = () => {
      const count = handCardsEl.children.length;
      handCardsEl.style.removeProperty('--hand-card-overlap');
      if (count <= 1) return;
      const available = scrollEl.clientWidth;
      const naturalWidth = handCardsEl.scrollWidth;
      if (naturalWidth <= available) return;
      const firstCardEl = handCardsEl.querySelector('[data-variant="hand"]') as HTMLElement | null;
      if (!firstCardEl) return;
      const cardWidth = firstCardEl.offsetWidth;
      const neededOverlap = (cardWidth * count - available) / (count - 1);
      const maxOverlap = cardWidth - 5;
      const overlap = Math.min(Math.max(0, neededOverlap), maxOverlap);
      handCardsEl.style.setProperty('--hand-card-overlap', `-${overlap}px`);
    };

    const observer = new ResizeObserver(update);
    observer.observe(scrollEl);
    update();
    return () => observer.disconnect();
  }, []);

  const setHoveredIndex = (index: number | null) => {
    const el = handCardsRef.current;
    if (!el) return;
    const children = el.children;
    const count = children.length;
    const prev = hoveredHandIndexRef.current;
    hoveredHandIndexRef.current = index;

    if (prev != null) {
      const lo = Math.max(0, prev - HOVER_RADIUS);
      const hi = Math.min(count - 1, prev + HOVER_RADIUS);
      for (let i = lo; i <= hi; i++) {
        if (index != null && Math.abs(index - i) <= HOVER_RADIUS) continue;
        resetCardStyle(children[i] as HTMLElement, i + 1);
      }
    }

    if (index != null) {
      const lo = Math.max(0, index - HOVER_RADIUS);
      const hi = Math.min(count - 1, index + HOVER_RADIUS);
      for (let i = lo; i <= hi; i++) {
        const distance = Math.abs(index - i);
        const tier = HOVER_TIERS[distance];
        if (tier) {
          applyCardStyle(children[i] as HTMLElement, tier.scale, tier.lift, count + 1);
        }
      }
      (children[index] as HTMLElement).style.zIndex = `${count + 1}`;
    }
  };

  const handleMouseLeave = useCallback(() => {
    const el = handCardsRef.current;
    if (!el) return;
    const prev = hoveredHandIndexRef.current;
    hoveredHandIndexRef.current = null;
    if (prev == null) return;
    const children = el.children;
    const lo = Math.max(0, prev - HOVER_RADIUS);
    const hi = Math.min(children.length - 1, prev + HOVER_RADIUS);
    for (let i = lo; i <= hi; i++) {
      resetCardStyle(children[i] as HTMLElement, i + 1);
    }
  }, []);

  const cards = Array.from({ length: CARD_COUNT }, (_, i) => i);

  return (
    <div style={{ background: '#0d1117', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div style={{ padding: '20px', color: '#aaa', fontFamily: 'monospace' }}>
        <h2 style={{ color: '#fff', marginBottom: 8 }}>HandRail Perf Test - {CARD_COUNT} cards</h2>
        <p>Hover the cards below. Open DevTools Performance tab to profile.</p>
        <p id="fps-counter" style={{ marginTop: 8 }}></p>
      </div>

      <div className="arena-seat" data-position="bottom-right" style={{ width: '100%' }}>
        <div className="arena-seat__zone-rail">
          <div className="arena-seat__hand-area">
            <div className="arena-seat__hand-scroll" ref={scrollRef} onMouseLeave={handleMouseLeave}>
              <div className="arena-seat__hand-rail">
                <div className="arena-seat__hand-cards" ref={handCardsRef}>
                  {cards.map((i) => (
                    <div
                      key={i}
                      className="arena-seat__hand-card"
                      onMouseEnter={() => setHoveredIndex(i)}
                    >
                      <div
                        className="arena-card"
                        data-variant="hand"
                        style={{ '--card-cursor': 'pointer' } as React.CSSProperties}
                      >
                        <div className="arena-card__frame">
                          <div className="arena-card__image-wrap">
                            <div className="arena-card__placeholder" />
                          </div>
                          <div className="arena-card__surface" />
                          <div className="arena-card__chrome">
                            <div className="arena-card__name">Card {i}</div>
                          </div>
                          <div className="arena-card__footer">
                            <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                              <div className="arena-card__type">Basic Land</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// FPS counter
let lastTime = performance.now();
let frames = 0;
function tick() {
  frames++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    const el = document.getElementById('fps-counter');
    if (el) el.textContent = `FPS: ${frames}`;
    frames = 0;
    lastTime = now;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

ReactDOM.createRoot(document.getElementById('root')!).render(<TestHandRail />);
