import path from 'node:path';
import react from '@vitejs/plugin-react';

const root = '/Users/ironsha/Desktop/projects/openarena/.worktrees/orchestrate-1774511467867';

export default {
  root,
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': path.resolve(root, './src/engine'),
      '@cards': path.resolve(root, './src/cards'),
      '@ui': path.resolve(root, './src/ui'),
    },
  },
};
