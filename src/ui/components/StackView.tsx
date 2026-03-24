import React from 'react';
import type { GameState, PlayerId, StackEntry } from '../../engine/types';
import { StackEntryType } from '../../engine/types';
import { findCardName } from '../utils/gameView';

interface StackViewProps {
  stack: StackEntry[];
  state: GameState;
}

function getStackEntryName(entry: StackEntry): string {
  if (entry.cardInstance) {
    return entry.cardInstance.definition.name;
  }
  if (entry.ability && 'description' in entry.ability) {
    return entry.ability.description;
  }
  return 'Unknown ability';
}

function getTypeLabel(entryType: StackEntryType): string {
  switch (entryType) {
    case StackEntryType.SPELL:
      return 'Spell';
    case StackEntryType.ACTIVATED_ABILITY:
      return 'Ability';
    case StackEntryType.TRIGGERED_ABILITY:
      return 'Trigger';
    default:
      return 'Stack';
  }
}

function formatTargets(targets: (string | PlayerId)[], state: GameState): string {
  if (targets.length === 0) {
    return 'No targets';
  }

  return targets
    .map((target) => {
      if (target.startsWith('player')) {
        return state.players[target as PlayerId]?.name ?? target;
      }
      return findCardName(state, target);
    })
    .join(', ');
}

export const StackView: React.FC<StackViewProps> = ({ stack, state }) => {
  const visibleEntries = [...stack].reverse();

  return (
    <div className="arena-stack-panel">
      <div className="arena-stack-panel__title">Stack</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {visibleEntries.map((entry, index) => (
          <div
            key={entry.id}
            className="arena-stack-panel__entry"
            data-top={index === 0}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <strong>{getStackEntryName(entry)}</strong>
              <span className="arena-preview__meta">{getTypeLabel(entry.entryType)}</span>
            </div>
            <div className="arena-preview__meta">
              Controlled by {state.players[entry.controller]?.name ?? entry.controller}
            </div>
            <div className="arena-preview__meta">{formatTargets(entry.targets, state)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
