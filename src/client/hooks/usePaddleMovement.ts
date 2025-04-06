import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { updateLeftPaddle, updateRightPaddle } from '../store/slices/gameSlice';
import type { AppDispatch } from '../store/store';

interface UsePaddleMovementProps {
  side: 'left' | 'right';
  boardHeight: number;
  paddleHeight: number;
}

export const calculatePaddlePosition = (clientY: number, rect: DOMRect, boardHeight: number, paddleHeight: number) => {
  // Calculate position relative to the game board
  const relativeY = clientY - rect.top;
  // Convert to percentage (0-100)
  const percentage = (relativeY / rect.height) * 100;
  // Ensure paddle stays within bounds
  const boundedPercentage = Math.max(0, Math.min(100 - (paddleHeight / boardHeight * 100), percentage));
  return boundedPercentage;
};

export const usePaddleMovement = ({ side, boardHeight, paddleHeight }: UsePaddleMovementProps) => {
  const dispatch = useDispatch<AppDispatch>();
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const gameBoard = document.getElementById('game-board');
    if (!gameBoard) return;

    const rect = gameBoard.getBoundingClientRect();
    const position = calculatePaddlePosition(e.clientY, rect, boardHeight, paddleHeight);

    if (side === 'left') {
      dispatch(updateLeftPaddle({ y: position }));
    } else {
      dispatch(updateRightPaddle({ y: position }));
    }
  }, [isDragging, side, dispatch, boardHeight, paddleHeight]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;

    const gameBoard = document.getElementById('game-board');
    if (!gameBoard) return;

    const rect = gameBoard.getBoundingClientRect();
    const touch = e.touches[0];
    const position = calculatePaddlePosition(touch.clientY, rect, boardHeight, paddleHeight);

    if (side === 'left') {
      dispatch(updateLeftPaddle({ y: position }));
    } else {
      dispatch(updateRightPaddle({ y: position }));
    }
  }, [isDragging, side, dispatch, boardHeight, paddleHeight]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  return {
    handleMouseDown,
    handleTouchStart,
    handleMouseMove,
    handleTouchMove,
    calculatePaddlePosition: (clientY: number, rect: DOMRect) => 
      calculatePaddlePosition(clientY, rect, boardHeight, paddleHeight),
  };
}; 