import React from 'react';
import './arena-theme.css';
import { GameBoard } from './components/GameBoard';
import { HandRailTestPage } from './components/HandRailTestPage';

function getRequestedTestPageId(): string | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return null;
  }

  const value = new URLSearchParams(window.location.search).get('test-page')?.trim();
  return value ? value : null;
}

const App: React.FC = () => {
  if (getRequestedTestPageId() === 'hand-rail') {
    return <HandRailTestPage />;
  }

  return <GameBoard />;
};

export default App;
