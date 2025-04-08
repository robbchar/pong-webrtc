import React from 'react';
import GameBoard from './components/GameBoard/GameBoard';
import styles from './App.module.css';

const App: React.FC = () => {
  return (
    <div className={styles.app}>
      <h1 className={styles.title}>Pong WebRTC</h1>
      <GameBoard />
    </div>
  );
};

export default App; 