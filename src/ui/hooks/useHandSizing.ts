import { useCallback, useMemo, useRef, useState, useEffect } from 'react';

const ASPECT = 0.715;
const BREAKPOINTS = {
  desktop: { maxW: 126, minW: 48, overlapRatio: 0.34 },
  tablet: { maxW: 98, minW: 40, overlapRatio: 0.29 },
  mobile: { maxW: 80, minW: 32, overlapRatio: 0.10 },
} as const;

function getBreakpoint(width: number) {
  if (width <= 760) return BREAKPOINTS.mobile;
  if (width <= 1024) return BREAKPOINTS.tablet;
  return BREAKPOINTS.desktop;
}

interface HandSizingResult {
  containerRef: React.RefCallback<HTMLElement>;
  style: React.CSSProperties;
}

export function useHandSizing(cardCount: number): HandSizingResult {
  const [containerWidth, setContainerWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number>(0);
  const lastWidthRef = useRef(0);

  const containerRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const entry = entries[0];
        if (!entry) return;
        const w = entry.contentRect.width;
        if (Math.abs(w - lastWidthRef.current) > 4) { lastWidthRef.current = w; setContainerWidth(w); }
      });
    });
    observer.observe(node);
    observerRef.current = observer;
    const rect = node.getBoundingClientRect();
    if (rect.width > 0) { lastWidthRef.current = rect.width; setContainerWidth(rect.width); }
  }, []);

  useEffect(() => { return () => { if (observerRef.current) observerRef.current.disconnect(); if (rafRef.current) cancelAnimationFrame(rafRef.current); }; }, []);

  const style = useMemo((): React.CSSProperties => {
    if (containerWidth === 0 || cardCount === 0) return {};
    const bp = getBreakpoint(containerWidth);
    const n = cardCount;
    const effectiveSlots = (1 - bp.overlapRatio) * (n - 1) + 1;
    const rawWidth = containerWidth / effectiveSlots;
    const cardWidth = Math.max(bp.minW, Math.min(bp.maxW, rawWidth));
    const cardHeight = cardWidth / ASPECT;
    const overlap = cardWidth * bp.overlapRatio;
    return { ['--hand-card-width' as string]: `${cardWidth}px`, ['--hand-card-height' as string]: `${cardHeight}px`, ['--hand-card-overlap' as string]: `-${overlap}px` } as React.CSSProperties;
  }, [containerWidth, cardCount]);

  return { containerRef, style };
}
