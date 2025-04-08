import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import GameBoard from './components/GameBoard/GameBoard';
import { signalingService } from './services/signalingService';
import styles from './App.module.css';

const App: React.FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    signalingService.init(dispatch);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:8080`;

    console.log(`Connecting to Signaling Server at: ${wsUrl}`)
    signalingService.connect(wsUrl);

    return () => {
      signalingService.disconnect();
    };
  }, [dispatch]);

  return (
    <div className={styles.app}>
      <h1 className={styles.title}>Pong WebRTC</h1>
      <GameBoard />
    </div>
  );
};

export default App; 