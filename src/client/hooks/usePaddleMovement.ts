import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { updatePaddle } from '../redux/slices/gameSlice';
import { webRTCService } from '@/services/webRTCService';
import { ConnectionState } from '@/store/slices/connectionSlice';

interface PaddleMovementConfig {
  speed: number;
  smoothing: number;
  minY: number;
  maxY: number;
}

const DEFAULT_CONFIG: PaddleMovementConfig = {
  speed: 10,
  smoothing: 0.2,
  minY: 0,
  maxY: 400, // This should match the canvas height minus paddle height
};

export const usePaddleMovement = (
  paddleId: 'left' | 'right',
  config: Partial<PaddleMovementConfig> = {}
) => {
  const dispatch = useAppDispatch();
  const currentConfig = { ...DEFAULT_CONFIG, ...config };
  const targetPosition = useRef<number>(0);
  const currentPosition = useRef<number>(0);
  const animationFrameId = useRef<number | undefined>(undefined);
  const [isMoving, setIsMoving] = useState(false);

  const paddle = useAppSelector(state => 
    paddleId === 'left' ? state.game.leftPaddle : state.game.rightPaddle
  );
  
  const dataChannelStatus = useAppSelector((state: { connection: ConnectionState }) => 
    state.connection.dataChannelStatus
  );

  // Initialize positions
  useEffect(() => {
    targetPosition.current = paddle.y;
    currentPosition.current = paddle.y;
  }, [paddle.y]);

  const updateTargetPosition = useCallback((clientY: number, rect: DOMRect) => {
    if (!isMoving) return;
    
    const relativeY = clientY - rect.top;
    targetPosition.current = Math.max(
      currentConfig.minY,
      Math.min(currentConfig.maxY, relativeY)
    );
  }, [currentConfig.minY, currentConfig.maxY, isMoving]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    updateTargetPosition(event.clientY, rect);
  }, [updateTargetPosition]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    updateTargetPosition(event.touches[0].clientY, rect);
  }, [updateTargetPosition]);

  const startMovement = useCallback(() => {
    setIsMoving(true);
  }, []);

  const stopMovement = useCallback(() => {
    setIsMoving(false);
  }, []);

  // Animation loop for smooth movement
  const updatePosition = useCallback(() => {
    const positionChanged = Math.abs(currentPosition.current - targetPosition.current) > 0.1; 
    
    if (isMoving && positionChanged) {
      // Smooth transition using linear interpolation
      const delta = (targetPosition.current - currentPosition.current) * currentConfig.smoothing;
      currentPosition.current += delta;
      const roundedPosition = Math.round(currentPosition.current);

      // Update paddle position in Redux store
      dispatch(updatePaddle({
        player: paddleId,
        position: roundedPosition
      }));
      
      // Send position update over data channel if open
      if (dataChannelStatus === 'open') {
        webRTCService.sendGameData({ type: 'paddleMove', payload: { y: roundedPosition } });
      }
    }
    
    // Continue the animation loop
    animationFrameId.current = window.requestAnimationFrame(updatePosition);
  }, [dispatch, paddleId, currentConfig.smoothing, isMoving, dataChannelStatus]);

  // Set up event listeners and animation loop
  useEffect(() => {
    const element = document.getElementById('game-canvas');
    if (!element) return;

    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('touchmove', handleTouchMove);
    element.addEventListener('mousedown', startMovement);
    element.addEventListener('touchstart', startMovement);
    element.addEventListener('mouseup', stopMovement);
    element.addEventListener('touchend', stopMovement);
    element.addEventListener('mouseleave', stopMovement);

    // Start animation loop
    animationFrameId.current = window.requestAnimationFrame(updatePosition);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('mousedown', startMovement);
      element.removeEventListener('touchstart', startMovement);
      element.removeEventListener('mouseup', stopMovement);
      element.removeEventListener('touchend', stopMovement);
      element.removeEventListener('mouseleave', stopMovement);
      
      if (animationFrameId.current !== undefined) {
        window.cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = undefined;
      }
    };
  }, [handleMouseMove, handleTouchMove, startMovement, stopMovement, updatePosition]);

  return {
    startMovement,
    stopMovement,
    isMoving
  };
}; 