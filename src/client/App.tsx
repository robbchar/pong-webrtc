import React from 'react';
import styles from './App.module.css';
import sharedStyles from './styles/shared.module.css';

const App: React.FC = () => {
  return (
    <div className={`${styles.app} ${sharedStyles.flexCenter} ${sharedStyles.flexColumn}`}>
      <h1 className={sharedStyles.glowText}>Pong WebRTC</h1>
      {/* Game components will be added here */}
    </div>
  );
};

export default App; 