import React from 'react';
import type { ManaCost } from '../../engine/types';
import { manaCostToString } from '../../engine/types';

const MANA_SYMBOL_COLORS: Record<string, string> = {
  W: '#f9f5e3',
  U: '#0e68ab',
  B: '#45373a',
  R: '#d3202a',
  G: '#00733e',
  C: '#beb9b2',
};

interface ManaCostViewProps {
  cost: ManaCost;
}

export const ManaCostView: React.FC<ManaCostViewProps> = ({ cost }) => {
  const tokens = manaCostToString(cost).match(/\{[^}]+\}/g) ?? [];

  return (
    <span className="arena-mana-cost" aria-label={manaCostToString(cost)}>
      {tokens.map((token, index) => {
        const symbol = token.slice(1, -1);
        const isGeneric = /^\d+$/.test(symbol) || symbol === 'X';
        const background = isGeneric ? '#6f7278' : MANA_SYMBOL_COLORS[symbol] ?? '#7c828f';
        const textColor = symbol === 'W' || symbol === 'C' || isGeneric ? '#21252c' : '#ffffff';

        return (
          <span
            key={`${token}-${index}`}
            className="arena-mana-cost__symbol"
            style={{ backgroundColor: background, color: textColor }}
          >
            {symbol}
          </span>
        );
      })}
    </span>
  );
};
