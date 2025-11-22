import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState } from "@/store/slices/gameSlice";
import { useAppSelector } from "@/store/hooks";

export interface InterpolatedGameState {
  ball: GameState["ball"];
  leftPaddleY: number;
  rightPaddleY: number;
}

interface Snapshot {
  timestampMs: number;
  ball: GameState["ball"];
  leftPaddleY: number;
  rightPaddleY: number;
}

export function interpolateSnapshots(
  previous: Snapshot | null,
  latest: Snapshot,
  nowMs: number,
): InterpolatedGameState {
  if (!previous) {
    return {
      ball: latest.ball,
      leftPaddleY: latest.leftPaddleY,
      rightPaddleY: latest.rightPaddleY,
    };
  }

  const timeDeltaMs = latest.timestampMs - previous.timestampMs;
  const rawT =
    timeDeltaMs <= 0 ? 1 : (nowMs - previous.timestampMs) / timeDeltaMs;
  const t = Math.max(0, Math.min(1, rawT));

  const lerp = (a: number, b: number) => a + (b - a) * t;

  return {
    ball: {
      x: lerp(previous.ball.x, latest.ball.x),
      y: lerp(previous.ball.y, latest.ball.y),
      velocityX: lerp(previous.ball.velocityX, latest.ball.velocityX),
      velocityY: lerp(previous.ball.velocityY, latest.ball.velocityY),
    },
    leftPaddleY: lerp(previous.leftPaddleY, latest.leftPaddleY),
    rightPaddleY: lerp(previous.rightPaddleY, latest.rightPaddleY),
  };
}

/**
 * Guest-only interpolation hook. Host should render directly from Redux.
 * This hook intentionally stores interpolation state locally and does not
 * mutate Redux, preserving host authority.
 */
export function useInterpolatedGameState(
  isHost: boolean,
): InterpolatedGameState {
  const gameState = useAppSelector((state) => state.game);

  const latestSnapshotRef = useRef<Snapshot | null>(null);
  const previousSnapshotRef = useRef<Snapshot | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const latestSnapshotFromRedux: Snapshot = useMemo(
    () => ({
      timestampMs: Date.now(),
      ball: gameState.ball,
      leftPaddleY: gameState.leftPaddle.y,
      rightPaddleY: gameState.rightPaddle.y,
    }),
    [gameState.ball, gameState.leftPaddle.y, gameState.rightPaddle.y],
  );

  const [interpolatedState, setInterpolatedState] =
    useState<InterpolatedGameState>(() =>
      interpolateSnapshots(null, latestSnapshotFromRedux, Date.now()),
    );

  useEffect(() => {
    if (isHost) {
      setInterpolatedState({
        ball: latestSnapshotFromRedux.ball,
        leftPaddleY: latestSnapshotFromRedux.leftPaddleY,
        rightPaddleY: latestSnapshotFromRedux.rightPaddleY,
      });
      return;
    }

    const currentLatest = latestSnapshotRef.current;

    if (
      currentLatest &&
      latestSnapshotFromRedux.timestampMs <= currentLatest.timestampMs
    ) {
      return;
    }

    previousSnapshotRef.current = currentLatest;
    latestSnapshotRef.current = latestSnapshotFromRedux;
  }, [isHost, latestSnapshotFromRedux]);

  useEffect(() => {
    if (isHost) {
      return;
    }

    const animate = () => {
      const previous = previousSnapshotRef.current;
      const latest = latestSnapshotRef.current ?? latestSnapshotFromRedux;
      const nowMs = Date.now();

      setInterpolatedState(interpolateSnapshots(previous, latest, nowMs));

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      animationFrameIdRef.current = null;
    };
  }, [isHost, latestSnapshotFromRedux]);

  return interpolatedState;
}
