import React, { Suspense } from 'react';
import './arena-theme.css';
import { GameBoard } from './components/GameBoard';

const LazyAgentation = React.lazy(() =>
  import('agentation').then((m) => ({ default: m.Agentation }))
);

const App: React.FC = () => {
  return (
    <>
      <GameBoard />
      {import.meta.env.DEV && (
        <Suspense>
          <LazyAgentation />
        </Suspense>
      )}
    </>
  );
};

export default App;
