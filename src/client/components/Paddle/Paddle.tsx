import React from 'react';
import styles from './Paddle.module.css';
import { usePaddleMovement } from '../../hooks/usePaddleMovement';
import { BOARD_HEIGHT, PADDLE_HEIGHT } from '../../constants/game';

interface PaddleProps {
  side: 'left' | 'right';
  position: number;
}

const Paddle: React.FC<PaddleProps> = ({ side, position }) => {
  const { handleMouseDown, handleTouchStart } = usePaddleMovement({
    side,
    boardHeight: BOARD_HEIGHT,
    paddleHeight: PADDLE_HEIGHT,
  });

  // Clamp position between 0 and 100
  const clampedPosition = Math.max(0, Math.min(100, position));

  return (
    <div
      className={`${styles.paddle} ${styles[side]}`}
      style={{ top: `${clampedPosition}%` }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      data-testid={`${side}-paddle`}
    />
  );
};

export default Paddle; 