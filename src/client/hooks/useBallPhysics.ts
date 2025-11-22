import { useCallback, useEffect, useRef } from "react";
import { RootState } from "@/store/store";
import { updateBall, updateScore } from "@/store/slices/gameSlice";
import {
  BALL_SIZE,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  BALL_SPEED,
} from "@/constants/game";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

interface BallPhysicsConfig {
  speed: number;
  paddleBounce: number;
  wallBounce: number;
  maxAngle: number;
}

const defaultConfig: BallPhysicsConfig = {
  speed: BALL_SPEED,
  paddleBounce: 1.0,
  wallBounce: 1.0,
  maxAngle: Math.PI / 3, // 60 degrees
};

export const useBallPhysics = (config: BallPhysicsConfig = defaultConfig) => {
  const dispatch = useAppDispatch();
  const isHost = useAppSelector((state: RootState) => state.connection.isHost);
  const ball = useAppSelector((state: RootState) => state.game.ball);
  const leftPaddle = useAppSelector(
    (state: RootState) => state.game.leftPaddle,
  );
  const rightPaddle = useAppSelector(
    (state: RootState) => state.game.rightPaddle,
  );
  const score = useAppSelector((state: RootState) => state.game.score);
  const gameStatus = useAppSelector((state: RootState) => state.game.status);
  const animationFrameRef = useRef<number>(0);

  const updateBallPosition = useCallback(
    (
      ball: {
        x: number;
        y: number;
        velocityX: number;
        velocityY: number;
      },
      leftPaddle: { y: number },
      rightPaddle: { y: number },
      score: { left: number; right: number },
    ) => {
      const newBall = { ...ball };
      newBall.x += newBall.velocityX;
      newBall.y += newBall.velocityY;

      const ballRadius = BALL_SIZE / 2;
      const ballLeft = newBall.x - ballRadius;
      const ballRight = newBall.x + ballRadius;
      const ballTop = newBall.y - ballRadius;
      const ballBottom = newBall.y + ballRadius;

      const currentSpeedMagnitude = Math.hypot(ball.velocityX, ball.velocityY);
      const speedMagnitude =
        currentSpeedMagnitude > 0 ? currentSpeedMagnitude : config.speed;
      const speedIncreasePerHit = config.speed * 0.05;
      const maxSpeedMagnitude = config.speed * 2.5;
      const nextSpeedMagnitude =
        speedMagnitude >= maxSpeedMagnitude
          ? speedMagnitude
          : Math.min(speedMagnitude + speedIncreasePerHit, maxSpeedMagnitude);

      // Wall collision (top/bottom)
      if (ballTop <= 0 || ballBottom >= 100) {
        newBall.velocityY = -newBall.velocityY * config.wallBounce;
        newBall.y = ballTop <= 0 ? ballRadius : 100 - ballRadius;
      }

      // Paddle collision AABB + angle bounce
      const leftPaddleTop = leftPaddle.y;
      const leftPaddleBottom = leftPaddle.y + PADDLE_HEIGHT;
      const rightPaddleTop = rightPaddle.y;
      const rightPaddleBottom = rightPaddle.y + PADDLE_HEIGHT;

      const leftPaddleXMin = 0;
      const leftPaddleXMax = PADDLE_WIDTH;
      const rightPaddleXMin = 100 - PADDLE_WIDTH;
      const rightPaddleXMax = 100;

      const overlapsLeftPaddle =
        ballLeft <= leftPaddleXMax &&
        ballRight >= leftPaddleXMin &&
        ballBottom >= leftPaddleTop &&
        ballTop <= leftPaddleBottom &&
        newBall.velocityX < 0;

      if (overlapsLeftPaddle) {
        const paddleCenterY = leftPaddleTop + PADDLE_HEIGHT / 2;
        const hitFraction = (newBall.y - paddleCenterY) / (PADDLE_HEIGHT / 2);
        const clampedHitFraction = Math.max(-1, Math.min(1, hitFraction));
        const baseReflectedAngle = Math.atan2(ball.velocityY, -ball.velocityX);
        const bounceAngle =
          baseReflectedAngle + clampedHitFraction * config.maxAngle;

        newBall.velocityX =
          Math.abs(Math.cos(bounceAngle)) *
          nextSpeedMagnitude *
          config.paddleBounce;
        newBall.velocityY =
          Math.sin(bounceAngle) * nextSpeedMagnitude * config.paddleBounce;
        newBall.x = leftPaddleXMax + ballRadius;
      }

      const overlapsRightPaddle =
        ballRight >= rightPaddleXMin &&
        ballLeft <= rightPaddleXMax &&
        ballBottom >= rightPaddleTop &&
        ballTop <= rightPaddleBottom &&
        newBall.velocityX > 0;

      if (overlapsRightPaddle) {
        const paddleCenterY = rightPaddleTop + PADDLE_HEIGHT / 2;
        const hitFraction = (newBall.y - paddleCenterY) / (PADDLE_HEIGHT / 2);
        const clampedHitFraction = Math.max(-1, Math.min(1, hitFraction));
        const baseReflectedAngle = Math.atan2(ball.velocityY, -ball.velocityX);
        const bounceAngle =
          baseReflectedAngle + clampedHitFraction * config.maxAngle;

        newBall.velocityX =
          -Math.abs(Math.cos(bounceAngle)) *
          nextSpeedMagnitude *
          config.paddleBounce;
        newBall.velocityY =
          Math.sin(bounceAngle) * nextSpeedMagnitude * config.paddleBounce;
        newBall.x = rightPaddleXMin - ballRadius;
      }

      // Scoring (ball fully past paddles)
      if (ballRight < 0) {
        const nextRightScore = score.right + 1;
        const verticalServeVelocity =
          (Math.random() * 2 - 1) * config.speed * 0.3;
        dispatch(updateScore({ player: "right", points: nextRightScore }));
        dispatch(
          updateBall({
            x: 50,
            y: 50,
            velocityX: config.speed,
            velocityY: verticalServeVelocity,
          }),
        );
        return;
      }

      if (ballLeft > 100) {
        const nextLeftScore = score.left + 1;
        const verticalServeVelocity =
          (Math.random() * 2 - 1) * config.speed * 0.3;
        dispatch(updateScore({ player: "left", points: nextLeftScore }));
        dispatch(
          updateBall({
            x: 50,
            y: 50,
            velocityX: -config.speed,
            velocityY: verticalServeVelocity,
          }),
        );
        return;
      }

      return newBall;
    },
    [
      config.maxAngle,
      config.paddleBounce,
      config.speed,
      config.wallBounce,
      dispatch,
    ],
  );

  useEffect(() => {
    if (isHost !== true) {
      return;
    }

    const animate = () => {
      const newBall = updateBallPosition(ball, leftPaddle, rightPaddle, score);
      if (newBall) {
        dispatch(updateBall(newBall));
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (gameStatus === "playing") {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    updateBallPosition,
    isHost,
    gameStatus,
    ball,
    leftPaddle,
    rightPaddle,
    score,
    dispatch,
  ]);

  return {
    ball,
    leftPaddle,
    rightPaddle,
  };
};
