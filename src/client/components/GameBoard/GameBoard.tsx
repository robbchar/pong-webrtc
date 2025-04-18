import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { setReady, setGameStatus } from '@/store/slices/gameSlice';
import Paddle from '../Paddle/Paddle';
import Ball from '../Ball/Ball';
import { useBallMovement } from '@/hooks/useBallMovement';
import { useCountdown } from '@/hooks/useCountdown';
import useDeviceOrientation from '@/hooks/useDeviceOrientation';
import styles from './GameBoard.module.css';
import { webRTCService } from '@/services/webRTCService';

const GameBoard: React.FC = () => {
  const dispatch = useDispatch();
  const { 
    status, 
    isReady, 
    score,
    wins
  } = useSelector((state: RootState) => state.game);
  const { 
    signalingStatus,
    peerStatus,
    dataChannelStatus,
    isHost,
    gameId,
    error
  } = useSelector((state: RootState) => state.connection);
  const { ball, leftPaddle, rightPaddle } = useSelector((state: RootState) => state.game);
  const { isPortrait } = useDeviceOrientation();

  // Only initialize ball movement when the game is playing
  useBallMovement({ isHost: isHost ?? false });
  useCountdown();

  useEffect(() => {
    // Set up WebRTC service dispatch
    webRTCService.setDispatch(dispatch);
  }, [dispatch]);

  const handleReadyClick = () => {
    console.log('[GameBoard] Ready button clicked. States:', {
      peerStatus,
      dataChannelStatus,
      isReady,
      isHost,
      gameId
    });

    try {
      const newReadyState = !isReady;
      dispatch(setReady(newReadyState));
      webRTCService.sendReadyState(newReadyState);
    } catch (error) {
      console.error('[GameBoard] Failed to update ready state:', error);
      dispatch(setReady(isReady));
    }
  };

  const getConnectionMessage = () => {
    if (error) {
      return error;
    }

    if (signalingStatus !== 'open') {
      return 'Connecting to server...';
    }

    if (peerStatus === 'connecting') {
      return 'Establishing connection...';
    }

    if (peerStatus === 'connected' && dataChannelStatus === 'open') {
      return isReady ? 'Waiting for opponent...' : 'Click Ready to start';
    }

    return 'Connecting...'; 
  };

  const renderOverlay = () => { 
    const message = getConnectionMessage();
    // console.log(`peerStatus: ${peerStatus}, dataChannelStatus: ${dataChannelStatus}, isReady: ${isReady}`);
    return (
      <div className={styles.overlay}>
        <div className={styles.message}>{message}</div>
        {peerStatus === 'connected' && dataChannelStatus === 'open' && !isReady && (
          <button 
            className={styles.readyButton}
            onClick={handleReadyClick}
          >
            Ready
          </button>
        )}
      </div>
    );
  };

  return (
    <div 
      className={`${styles.gameBoard} ${isPortrait ? styles.portrait : styles.landscape}`}
      data-testid="game-board"
    >
      <div className={styles.centerLine} data-testid="center-line" />
      <Paddle side="left" position={leftPaddle.y} />
      <Paddle side="right" position={rightPaddle.y} />
      <Ball x={ball.x} y={ball.y} />
      
      {/* Score Display */}
      <div className={styles.scoreContainer}>
        <div className={styles.score}>
          <div className={styles.wins}>
            {Array(wins.left).fill(0).map((_, i) => (
              <span key={i} className={styles.tick}>✓</span>
            ))}
          </div>
          <div className={styles.points}>{score.left}</div>
        </div>
        <div className={styles.score}>
          <div className={styles.wins}>
            {Array(wins.right).fill(0).map((_, i) => (
              <span key={i} className={styles.tick}>✓</span>
            ))}
          </div>
          <div className={styles.points}>{score.right}</div>
        </div>
      </div>

      {/* Game controls */}
      {status === 'playing' && (
        <button 
          className={styles.pauseButton} 
          onClick={() => dispatch(setGameStatus('paused'))}
        >
          ⏸
        </button>
      )}

      {/* Game overlays */}
      {renderOverlay()}
    </div>
  );
};

export default GameBoard; 