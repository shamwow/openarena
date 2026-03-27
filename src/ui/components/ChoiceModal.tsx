import React, { useState } from 'react';
import type { CardInstance } from '../../engine/types';
import type { ChoiceRequest } from '../../engine/GameEngine';

interface ChoiceModalProps {
  choice: ChoiceRequest;
  onResolve: (result: unknown) => void;
}

function getLabel(item: unknown, labelFn?: (item: unknown) => string): string {
  if (labelFn) {
    try {
      return labelFn(item);
    } catch {
      return 'Choice';
    }
  }

  if (typeof item === 'string') {
    return item;
  }
  if (typeof item === 'boolean') {
    return item ? 'Yes' : 'No';
  }
  if (typeof item === 'number') {
    return String(item);
  }
  if (item && typeof item === 'object') {
    if ('definition' in item && (item as CardInstance).definition?.name) {
      return (item as CardInstance).definition.name;
    }
    if ('name' in item) {
      return (item as { name: string }).name;
    }
  }

  return String(item);
}

function ChoiceButton({
  label,
  onClick,
  selected = false,
}: {
  label: string;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        borderRadius: 14,
        border: `1px solid ${selected ? 'rgba(215, 174, 105, 0.52)' : 'rgba(255, 255, 255, 0.08)'}`,
        background: selected ? 'rgba(215, 174, 105, 0.12)' : 'rgba(255, 255, 255, 0.04)',
        color: 'var(--arena-text)',
        padding: '12px 14px',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

export const ChoiceModal: React.FC<ChoiceModalProps> = ({ choice, onResolve }) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const allowDuplicates = choice.type === 'chooseN' && choice.allowDuplicates;
  const maxSelections = choice.count ?? 1;
  const selectionCounts = selectedIndices.reduce<Map<number, number>>((counts, index) => {
    counts.set(index, (counts.get(index) ?? 0) + 1);
    return counts;
  }, new Map());

  const toggleSelection = (index: number) => {
    if (allowDuplicates) {
      setSelectedIndices((current) => {
        if (current.length >= maxSelections) {
          return current;
        }
        return [...current, index];
      });
      return;
    }

    setSelectedIndices((current) => {
      const existingIndex = current.indexOf(index);
      if (existingIndex >= 0) {
        return current.filter((selectedIndex) => selectedIndex !== index);
      }

      if ((choice.type === 'chooseN' || choice.type === 'chooseUpToN') && current.length >= maxSelections) {
        return current;
      }

      return [...current, index];
    });
  };

  const clearSelections = () => {
    setSelectedIndices([]);
  };

  const confirmMultiChoice = () => {
    const selected = selectedIndices.map((index) => choice.options[index]);
    onResolve(selected);
  };

  const canConfirm =
    choice.type === 'chooseN'
      ? selectedIndices.length === maxSelections
      : choice.type === 'chooseUpToN'
        ? selectedIndices.length > 0 && selectedIndices.length <= maxSelections
        : true;

  const selectionSummary = allowDuplicates
    ? selectedIndices.map((index, selectionIndex) => `${selectionIndex + 1}. ${getLabel(choice.options[index], choice.labelFn)}`).join('  ')
    : null;

  return (
    <div className="arena-choice-modal">
      <div className="arena-choice-modal__panel">
        <div
          style={{
            fontFamily: 'var(--arena-title-font)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            marginBottom: 14,
          }}
        >
          Choice Required
        </div>

        <div style={{ marginBottom: 18, color: 'var(--arena-text-soft)', lineHeight: 1.45 }}>
          {choice.prompt}
        </div>

        {choice.type === 'chooseYesNo' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="arena-pass-button" onClick={() => onResolve(true)}>
              Yes
            </button>
            <button className="arena-ghost-button" onClick={() => onResolve(false)}>
              No
            </button>
          </div>
        )}

        {choice.type === 'choosePlayer' && (
          <div style={{ display: 'grid', gap: 8 }}>
            {choice.options.map((option, index) => (
              <ChoiceButton
                key={`player-${index}`}
                label={getLabel(option, choice.labelFn)}
                onClick={() => onResolve(option)}
              />
            ))}
          </div>
        )}

        {choice.type === 'chooseOne' && (
          <div style={{ display: 'grid', gap: 8 }}>
            {choice.options.map((option, index) => (
              <ChoiceButton
                key={`single-${index}`}
                label={getLabel(option, choice.labelFn)}
                onClick={() => onResolve(option)}
              />
            ))}
          </div>
        )}

        {(choice.type === 'chooseN' ||
          choice.type === 'chooseUpToN' ||
          choice.type === 'orderObjects') && (
          <div style={{ display: 'grid', gap: 8 }}>
            <div className="arena-preview__meta">
              {choice.type === 'orderObjects'
                ? 'Select items in the order you want.'
                : choice.type === 'chooseN'
                  ? `Select exactly ${choice.count}.${allowDuplicates ? ' Repeat selections are allowed.' : ''}`
                  : `Select up to ${choice.count}.`}
            </div>

            {selectionSummary && (
              <div className="arena-preview__meta">
                {selectionSummary}
              </div>
            )}

            {choice.options.map((option, index) => {
              const count = selectionCounts.get(index) ?? 0;
              const label = getLabel(option, choice.labelFn);
              return (
                <ChoiceButton
                  key={`multi-${index}`}
                  label={count > 0 && allowDuplicates ? `${label} (${count})` : label}
                  selected={count > 0}
                  onClick={() => toggleSelection(index)}
                />
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <button className="arena-ghost-button" onClick={clearSelections}>
                Clear
              </button>
              <button
                className="arena-pass-button"
                onClick={confirmMultiChoice}
                disabled={!canConfirm}
                style={{ opacity: canConfirm ? 1 : 0.4 }}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
