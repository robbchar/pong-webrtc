import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../store/store";
import { updateBall, updateScore } from "../store/slices/gameSlice";
import {
  BALL_SPEED,
  BALL_SIZE,
  PADDLE_WIDTH,
  PADDLE_HEIGHT,
} from "../constants/game";

interface UseBallMovementProps {
  isHost: boolean;
}

export const useBallMovement = ({ isHost }: UseBallMovementProps) => {
  const dispatch = useDispatch();
  const { ball, leftPaddle, rightPaddle, score, status } = useSelector(
    (state: RootState) => state.game,
  );
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!isHost) return;
    if (status !== "playing") return;

    const moveBall = () => {
      // Calculate new position
      const newX = ball.x + ball.velocityX;
      const newY = ball.y + ball.velocityY;

      // Check wall collisions
      if (newY <= 0 || newY >= 100) {
        dispatch(
          updateBall({
            ...ball,
            y: newY <= 0 ? 0 : 100,
            velocityY: -ball.velocityY,
          }),
        );
      }

      // Check paddle collisions
      const ballLeft = newX - BALL_SIZE / 2;
      const ballRight = newX + BALL_SIZE / 2;
      const ballTop = newY - BALL_SIZE / 2;
      const ballBottom = newY + BALL_SIZE / 2;

      // Left paddle collision
      if (ballLeft <= PADDLE_WIDTH && ballRight >= 0) {
        const paddleTop = leftPaddle.y;
        const paddleBottom = leftPaddle.y + PADDLE_HEIGHT;

        if (ballTop <= paddleBottom && ballBottom >= paddleTop) {
          // Calculate bounce angle based on where the ball hits the paddle
          const hitPosition = (ball.y - leftPaddle.y) / PADDLE_HEIGHT;
          const bounceAngle = ((hitPosition - 0.5) * Math.PI) / 2; // -45 to 45 degrees

          dispatch(
            updateBall({
              ...ball,
              x: PADDLE_WIDTH,
              velocityX: Math.cos(bounceAngle) * BALL_SPEED,
              velocityY: Math.sin(bounceAngle) * BALL_SPEED,
            }),
          );
        }
      }

      // Right paddle collision
      if (ballRight >= 100 - PADDLE_WIDTH && ballLeft <= 100) {
        const paddleTop = rightPaddle.y;
        const paddleBottom = rightPaddle.y + PADDLE_HEIGHT;

        if (ballTop <= paddleBottom && ballBottom >= paddleTop) {
          // Calculate bounce angle based on where the ball hits the paddle
          const hitPosition = (ball.y - rightPaddle.y) / PADDLE_HEIGHT;
          const bounceAngle = ((hitPosition - 0.5) * Math.PI) / 2; // -45 to 45 degrees

          dispatch(
            updateBall({
              ...ball,
              x: 100 - PADDLE_WIDTH,
              velocityX: -Math.cos(bounceAngle) * BALL_SPEED,
              velocityY: Math.sin(bounceAngle) * BALL_SPEED,
            }),
          );
        }
      }

      // Check scoring
      if (newX <= 0) {
        dispatch(updateScore({ player: "right", points: score.right + 1 }));
        dispatch(
          updateBall({
            ...ball,
            x: 50,
            y: 50,
            velocityX: BALL_SPEED,
            velocityY: 0,
          }),
        );
      } else if (newX >= 100) {
        dispatch(updateScore({ player: "left", points: score.left + 1 }));
        dispatch(
          updateBall({
            ...ball,
            x: 50,
            y: 50,
            velocityX: -BALL_SPEED,
            velocityY: 0,
          }),
        );
      } else {
        // Normal movement
        dispatch(
          updateBall({
            ...ball,
            x: newX,
            y: newY,
          }),
        );
      }

      animationFrameRef.current = requestAnimationFrame(moveBall);
    };

    animationFrameRef.current = requestAnimationFrame(moveBall);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [ball, leftPaddle, rightPaddle, score, status, isHost, dispatch]);
};
