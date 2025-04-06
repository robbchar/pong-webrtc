import React from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import Paddle from '../Paddle/Paddle';
import Ball from '../Ball/Ball';
import { useBallMovement } from '@/hooks/useBallMovement';
import useDeviceOrientation from '@/hooks/useDeviceOrientation';
import styles from './GameBoard.module.css';
import sharedStyles from '@/styles/shared.module.css';

const GameBoard: React.FC = () => {
  const { ball, leftPaddle, rightPaddle, status } = useSelector((state: RootState) => state.game);
  const { isPortrait } = useDeviceOrientation();
  
  // For now, we'll assume the first player is the host
  useBallMovement({ isHost: true });

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
          {status === 'waiting' && (
            <button className={styles.readyButton} data-testid="ready-button">
              READY
            </button>
          )}
          {status === 'countdown' && (
            <div className={styles.countdown} data-testid="countdown">
              3
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