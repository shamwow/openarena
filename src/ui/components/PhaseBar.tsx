import React from 'react';
import type { GameState, PlayerAction } from '../../engine/types';
import { ActionType, Phase, Step } from '../../engine/types';

interface PhaseBarProps {
  state: GameState;
  legalActions: PlayerAction[];
  onAction: (action: PlayerAction) => void;
  onOpenSettings: () => void;
}

interface StepInfo {
  step: Step;
  phase: Phase;
  label: string;
  shortLabel: string;
}

const ALL_STEPS: StepInfo[] = [
  { step: Step.UNTAP, phase: Phase.BEGINNING, label: 'Untap', shortLabel: 'UT' },
  { step: Step.UPKEEP, phase: Phase.BEGINNING, label: 'Upkeep', shortLabel: 'UP' },
  { step: Step.DRAW, phase: Phase.BEGINNING, label: 'Draw', shortLabel: 'DR' },
  { step: Step.MAIN, phase: Phase.PRECOMBAT_MAIN, label: 'Main 1', shortLabel: 'M1' },
  { step: Step.BEGINNING_OF_COMBAT, phase: Phase.COMBAT, label: 'Begin Combat', shortLabel: 'BC' },
  { step: Step.DECLARE_ATTACKERS, phase: Phase.COMBAT, label: 'Attackers', shortLabel: 'AT' },
  { step: Step.DECLARE_BLOCKERS, phase: Phase.COMBAT, label: 'Blockers', shortLabel: 'BL' },
  { step: Step.FIRST_STRIKE_DAMAGE, phase: Phase.COMBAT, label: 'First Strike', shortLabel: 'FS' },
  { step: Step.COMBAT_DAMAGE, phase: Phase.COMBAT, label: 'Damage', shortLabel: 'DM' },
  { step: Step.END_OF_COMBAT, phase: Phase.COMBAT, label: 'End Combat', shortLabel: 'EC' },
  { step: Step.MAIN, phase: Phase.POSTCOMBAT_MAIN, label: 'Main 2', shortLabel: 'M2' },
  { step: Step.END, phase: Phase.ENDING, label: 'End', shortLabel: 'END' },
  { step: Step.CLEANUP, phase: Phase.ENDING, label: 'Cleanup', shortLabel: 'CL' },
];

const PHASE_COLORS: Record<Phase, string> = {
  [Phase.BEGINNING]: 'rgba(77, 156, 212, 0.32)',
  [Phase.PRECOMBAT_MAIN]: 'rgba(103, 186, 121, 0.32)',
  [Phase.COMBAT]: 'rgba(211, 102, 84, 0.36)',
  [Phase.POSTCOMBAT_MAIN]: 'rgba(103, 186, 121, 0.32)',
  [Phase.ENDING]: 'rgba(207, 154, 83, 0.34)',
};

function isCurrentStep(stepInfo: StepInfo, state: GameState): boolean {
  if (stepInfo.step !== state.currentStep) {
    return false;
  }

  if (stepInfo.step === Step.MAIN) {
    return stepInfo.phase === state.currentPhase;
  }

  return true;
}

export const PhaseBar: React.FC<PhaseBarProps> = ({
  state,
  legalActions,
  onAction,
  onOpenSettings,
}) => {
  const passAction = legalActions.find((action) => action.type === ActionType.PASS_PRIORITY);
  const meaningfulActionCount = legalActions.filter(
    (action) =>
      action.type !== ActionType.PASS_PRIORITY &&
      action.type !== ActionType.CONCEDE,
  ).length;

  return (
    <div className="arena-phase-bar">
      <div className="arena-phase-bar__top">
        <div
          style={{
            fontFamily: 'var(--arena-title-font)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontSize: '0.86rem',
          }}
        >
          Turn {state.turnNumber}
        </div>

        <div className="arena-phase-bar__actions">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            {meaningfulActionCount > 0 && (
              <div className="arena-preview__meta">
                {meaningfulActionCount} action{meaningfulActionCount === 1 ? '' : 's'} ready
              </div>
            )}
            {passAction && (
              <button className="arena-pass-button" onClick={() => onAction(passAction)}>
                Pass Priority
              </button>
            )}
          </div>

          <button
            type="button"
            className="arena-icon-button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Open settings"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.05 7.05 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.23-1.13.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.62-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.71 1.63.94l.36 2.54a.5.5 0 0 0 .5.42h3.84a.5.5 0 0 0 .5-.42l.36-2.54c.58-.23 1.13-.54 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="arena-phase-bar__steps">
        {ALL_STEPS.map((stepInfo) => {
          const isCurrent = isCurrentStep(stepInfo, state);
          return (
            <div
              key={`${stepInfo.phase}-${stepInfo.step}-${stepInfo.shortLabel}`}
              className="arena-phase-step"
              data-current={isCurrent}
              title={stepInfo.label}
              style={isCurrent ? { backgroundColor: PHASE_COLORS[stepInfo.phase] } : undefined}
            >
              {stepInfo.shortLabel}
            </div>
          );
        })}
      </div>

      {state.isGameOver && (
        <div
          style={{
            marginTop: 12,
            borderRadius: 14,
            border: '1px solid rgba(215, 174, 105, 0.36)',
            padding: '10px 14px',
            textAlign: 'center',
            color: '#ffe8b2',
            background: 'rgba(215, 174, 105, 0.08)',
          }}
        >
          {state.winner
            ? `${state.players[state.winner]?.name ?? state.winner} wins the game.`
            : 'Game over.'}
        </div>
      )}
    </div>
  );
};
