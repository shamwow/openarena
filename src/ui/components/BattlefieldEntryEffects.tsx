import React, { useEffect, useState } from 'react';
import type { BattlefieldEntryAnimation } from '../types';
import { CardView } from './CardView';

interface BattlefieldEntryEffectsProps {
  animations: BattlefieldEntryAnimation[];
  onAnimationEnd: (key: string) => void;
}

interface FlightCardProps {
  animation: BattlefieldEntryAnimation;
  onAnimationEnd: (key: string) => void;
}

const FLIGHT_DURATION_MS = 460;

const FlightCard: React.FC<FlightCardProps> = ({ animation, onAnimationEnd }) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setActive(true);
    });
    const timeoutId = window.setTimeout(() => {
      onAnimationEnd(animation.key);
    }, FLIGHT_DURATION_MS + 60);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [animation.key, onAnimationEnd]);

  const dx = animation.endRect.left - animation.startRect.left;
  const dy = animation.endRect.top - animation.startRect.top;
  const scale = animation.startRect.width > 0
    ? animation.endRect.width / animation.startRect.width
    : 1;

  return (
    <div
      className="arena-flight-card"
      data-active={active}
      style={
        {
          ['--flight-left' as string]: `${animation.startRect.left}px`,
          ['--flight-top' as string]: `${animation.startRect.top}px`,
          ['--flight-width' as string]: `${animation.startRect.width}px`,
          ['--flight-height' as string]: `${animation.startRect.height}px`,
          ['--flight-dx' as string]: `${dx}px`,
          ['--flight-dy' as string]: `${dy}px`,
          ['--flight-scale' as string]: `${scale}`,
        } as React.CSSProperties
      }
    >
      {animation.hiddenSource && (
        <div className="arena-flight-card__back" data-hidden="true">
          <div className="arena-card-back" />
        </div>
      )}
      <div className="arena-flight-card__front" data-hidden={animation.hiddenSource}>
        <CardView card={animation.card} variant="flight" />
      </div>
    </div>
  );
};

export const BattlefieldEntryEffects: React.FC<BattlefieldEntryEffectsProps> = ({
  animations,
  onAnimationEnd,
}) => {
  if (animations.length === 0) {
    return null;
  }

  return (
    <div className="arena-flight-layer" aria-hidden="true">
      {animations.map((animation) => (
        <FlightCard
          key={animation.key}
          animation={animation}
          onAnimationEnd={onAnimationEnd}
        />
      ))}
    </div>
  );
};
