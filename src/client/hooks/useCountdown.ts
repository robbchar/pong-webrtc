import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import {
  setGameStatus,
  setCountdown,
  updateBall,
} from "@/store/slices/gameSlice";
import { BALL_SPEED } from "@/constants/game";

export const useCountdown = ({ isHost = true }: { isHost?: boolean } = {}) => {
  const dispatch = useDispatch();
  const status = useSelector((state: RootState) => state.game.status);
  const countdown = useSelector((state: RootState) => state.game.countdown);
  const ball = useSelector((state: RootState) => state.game.ball);
  const score = useSelector((state: RootState) => state.game.score);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const latestCountdownRef = useRef(countdown);

  useEffect(() => {
    latestCountdownRef.current = countdown;
  }, [countdown]);

  useEffect(() => {
    if (!isHost) return;
    if (status !== "countdown") {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      const nextCountdown = latestCountdownRef.current - 1;
      latestCountdownRef.current = nextCountdown;
      dispatch(setCountdown(nextCountdown));

      if (nextCountdown <= 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        dispatch(setGameStatus("playing"));

        const ballIsStationary = ball.velocityX === 0 && ball.velocityY === 0;
        if (ballIsStationary) {
          const totalPoints = score.left + score.right;
          const serveDirection = totalPoints % 2 === 0 ? 1 : -1;
          dispatch(
            updateBall({
              ...ball,
              x: 50,
              y: 50,
              velocityX: serveDirection * BALL_SPEED,
              velocityY: 0,
            }),
          );
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, dispatch, isHost, ball, score]);

  return countdown;
};
