import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { setReady, setGameStatus } from '@/store/slices/gameSlice';
import Paddle from '../Paddle/Paddle';
import Ball from '../Ball/Ball';
import { useBallMovement } from '@/hooks/useBallMovement';
import useDeviceOrientation from '@/hooks/useDeviceOrientation';
import styles from './GameBoard.module.css';
import sharedStyles from '@/styles/shared.module.css';

const GameBoard: React.FC = () => {
  const dispatch = useDispatch();
  const { ball, leftPaddle, rightPaddle, status, isReady, countdown } = useSelector((state: RootState) => state.game);
  const { isPortrait } = useDeviceOrientation();
  
  // For now, we'll assume the first player is the host
  useBallMovement({ isHost: true });

  const handleReadyClick = () => {
    dispatch(setReady(true));
    // In a real implementation, this would trigger a WebRTC event to the other player
    // For now, we'll just start the countdown
    dispatch(setGameStatus('countdown'));
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
      {status !== 'playing' && (
        <div className={`${styles.overlay} ${sharedStyles.flexCenter} ${sharedStyles.flexColumn}`}>
          {status === 'waiting' && !isReady && (
            <button 
              className={styles.readyButton} 
              onClick={handleReadyClick}
              data-testid="ready-button"
            >
              READY
            </button>
          )}
          {status === 'countdown' && (
            <div className={styles.countdown} data-testid="countdown">
              {countdown}
            </div>
          )}
          {status === 'gameOver' && (
            <div className={styles.gameOver} data-testid="game-over">
              GAME OVER
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GameBoard; 