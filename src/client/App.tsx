import React from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import GameBoard from './components/GameBoard/GameBoard';
import styles from './App.module.css';

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <div className={styles.app}>
        <h1 className={styles.title}>Pong WebRTC</h1>
        <GameBoard />
      </div>
    </Provider>
  );
};

export default App; 