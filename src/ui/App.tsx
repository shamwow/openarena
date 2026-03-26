import React from 'react';
import './arena-theme.css';
import { GameBoard } from './components/GameBoard';
import { Agentation } from 'agentation';

const App: React.FC = () => {
  return (
    <>
      <GameBoard />
      {import.meta.env.DEV && <Agentation />}
    </>
  );
};

export default App;
