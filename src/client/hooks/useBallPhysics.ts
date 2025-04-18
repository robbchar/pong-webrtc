import { useCallback, useEffect, useRef } from 'react';
import { RootState } from '../redux/store';
import { updateBall, scorePoint } from '../redux/slices/gameSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

interface Vector2D {
  x: number;
  y: number;
}

interface BallPhysicsConfig {
  initialSpeed: number;
  speedIncrease: number;
  maxSpeed: number;
  paddleHeight: number;
  paddleWidth: number;
  boardWidth: number;
  boardHeight: number;
}

const DEFAULT_CONFIG: BallPhysicsConfig = {
  initialSpeed: 5,
  speedIncrease: 0.2,
  maxSpeed: 15,
  paddleHeight: 100,
  paddleWidth: 20,
  boardWidth: 800,
  boardHeight: 600,
};

export const useBallPhysics = (config: Partial<BallPhysicsConfig> = {}): { position: Vector2D; velocity: Vector2D } => {
  const dispatch = useAppDispatch();
  const { ball, leftPaddle, rightPaddle, status } = useAppSelector((state: RootState) => state.game);
  const frameRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number | undefined>(undefined);
  const ballRef = useRef(ball);

  const physicsConfig = { ...DEFAULT_CONFIG, ...config };

  // Update ballRef when ball changes
  useEffect(() => {
    ballRef.current = ball;
  }, [ball]);

  const checkPaddleCollision = useCallback((ballPos: Vector2D, ballVel: Vector2D): Vector2D => {
    const { paddleHeight, paddleWidth, boardWidth } = physicsConfig;

    // Left paddle collision
    if (
      ballPos.x <= paddleWidth &&
      ballPos.y >= leftPaddle.y &&
      ballPos.y <= leftPaddle.y + paddleHeight
    ) {
      const relativeIntersectY = (leftPaddle.y + paddleHeight / 2) - ballPos.y;
      const normalizedIntersect = relativeIntersectY / (paddleHeight / 2);
      const bounceAngle = normalizedIntersect * Math.PI / 4;
      
      return {
        x: Math.abs(ballVel.x),
        y: -Math.sin(bounceAngle) * Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y)
      };
    }

    // Right paddle collision
    if (
      ballPos.x >= boardWidth - paddleWidth &&
      ballPos.y >= rightPaddle.y &&
      ballPos.y <= rightPaddle.y + paddleHeight
    ) {
      const relativeIntersectY = (rightPaddle.y + paddleHeight / 2) - ballPos.y;
      const normalizedIntersect = relativeIntersectY / (paddleHeight / 2);
      const bounceAngle = normalizedIntersect * Math.PI / 4;
      
      return {
        x: -Math.abs(ballVel.x),
        y: -Math.sin(bounceAngle) * Math.sqrt(ballVel.x * ballVel.x + ballVel.y * ballVel.y)
      };
    }

    return ballVel;
  }, [leftPaddle.y, rightPaddle.y, physicsConfig]);

  const updateBallPosition = useCallback((timestamp: number) => {
    if (!lastUpdateRef.current) {
      lastUpdateRef.current = timestamp;
      frameRef.current = requestAnimationFrame(updateBallPosition);
      return;
    }

    const deltaTime = (timestamp - lastUpdateRef.current) / 16; // Normalize to ~60fps
    lastUpdateRef.current = timestamp;

    const { boardWidth, boardHeight } = physicsConfig;
    const currentBall = ballRef.current;
    const newPos = {
      x: currentBall.x + currentBall.vx * deltaTime,
      y: currentBall.y + currentBall.vy * deltaTime
    };

    // Schedule next frame before any early returns
    frameRef.current = requestAnimationFrame(updateBallPosition);

    // Wall collisions
    if (newPos.y <= 0 || newPos.y >= boardHeight) {
      dispatch(updateBall({
        ...newPos,
        vx: currentBall.vx,
        vy: -currentBall.vy
      }));
      return;
    }

    // Check for scoring
    if (newPos.x < 0) {
      dispatch(scorePoint('right'));
      return;
    }
    if (newPos.x > boardWidth) {
      dispatch(scorePoint('left'));
      return;
    }

    // Check paddle collisions and update position
    const newVelocity = checkPaddleCollision(newPos, { x: currentBall.vx, y: currentBall.vy });
    dispatch(updateBall({
      ...newPos,
      vx: newVelocity.x,
      vy: newVelocity.y
    }));
  }, [dispatch, checkPaddleCollision, physicsConfig]);

  useEffect(() => {
    if (status === 'playing') {
      frameRef.current = requestAnimationFrame(updateBallPosition);
    }
    
    return () => {
      if (frameRef.current) {
        // In tests, we're using setTimeout instead of requestAnimationFrame
        if (process.env.NODE_ENV === 'test') {
          clearTimeout(frameRef.current);
        } else {
          cancelAnimationFrame(frameRef.current);
        }
      }
    };
  }, [status, updateBallPosition]);

  return {
    position: { x: ball.x, y: ball.y },
    velocity: { x: ball.vx, y: ball.vy }
  };
}; 