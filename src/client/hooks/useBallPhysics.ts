import { useCallback, useEffect, useRef } from "react";
import { RootState } from "@/store/store";
import { updateBall, updateScore } from "@/store/slices/gameSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

interface BallPhysicsConfig {
  speed: number;
  paddleBounce: number;
  wallBounce: number;
  maxAngle: number;
}

const defaultConfig: BallPhysicsConfig = {
  speed: 0.5,
  paddleBounce: 1.0,
  wallBounce: 1.0,
  maxAngle: Math.PI / 4, // 45 degrees
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

      // Wall collision
      if (newBall.y <= 0 || newBall.y >= 100) {
        newBall.velocityY = -newBall.velocityY;
        newBall.y = newBall.y <= 0 ? 0 : 100;
      }

      // Paddle collision
      if (newBall.x <= 0) {
        if (Math.abs(newBall.y - leftPaddle.y) <= 10) {
          const relativeIntersectY = (leftPaddle.y - newBall.y) / 10;
          const bounceAngle = relativeIntersectY * config.maxAngle;
          newBall.velocityX = Math.cos(bounceAngle) * config.paddleBounce;
          newBall.velocityY = -Math.sin(bounceAngle) * config.paddleBounce;
          newBall.x = 0;
        } else {
          // Score point for right player
          dispatch(updateScore({ player: "right", points: score.right + 1 }));
          return;
        }
      } else if (newBall.x >= 100) {
        if (Math.abs(newBall.y - rightPaddle.y) <= 10) {
          const relativeIntersectY = (rightPaddle.y - newBall.y) / 10;
          const bounceAngle = relativeIntersectY * config.maxAngle;
          newBall.velocityX = -Math.cos(bounceAngle) * config.paddleBounce;
          newBall.velocityY = -Math.sin(bounceAngle) * config.paddleBounce;
          newBall.x = 100;
        } else {
          // Score point for left player
          dispatch(updateScore({ player: "left", points: score.left + 1 }));
          return;
        }
      }

      return newBall;
    },
    [config.maxAngle, config.paddleBounce, dispatch],
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
