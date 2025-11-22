import { useCallback, useEffect, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { updateLeftPaddle, updateRightPaddle } from "@/store/slices/gameSlice";
import { webRTCService } from "@/services/webRTCService";
import type { PaddleMoveMessage } from "@/types/dataChannelTypes";

interface UsePaddleMovementOptions {
  side: "left" | "right";
  boardHeight: number;
  paddleHeight: number;
  isLocalPlayer: boolean;
}

const SEND_INTERVAL_MS = 33;

export const usePaddleMovement = ({
  side,
  boardHeight,
  paddleHeight,
  isLocalPlayer,
}: UsePaddleMovementOptions) => {
  const dispatch = useAppDispatch();
  const { isHost, dataChannelStatus } = useAppSelector(
    (state) => state.connection,
  );
  const gameStatus = useAppSelector((state) => state.game.status);

  const isDraggingRef = useRef(false);
  const lastSentAtMsRef = useRef(0);
  const lastSentYRef = useRef<number | null>(null);

  const clampYPercent = useCallback(
    (yPercent: number) => {
      const maxY = Math.max(0, boardHeight - paddleHeight);
      return Math.max(0, Math.min(maxY, yPercent));
    },
    [boardHeight, paddleHeight],
  );

  const updatePaddlePosition = useCallback(
    (yPercent: number) => {
      if (side === "left") {
        dispatch(updateLeftPaddle(yPercent));
      } else {
        dispatch(updateRightPaddle(yPercent));
      }

      const shouldSendNetworkInput =
        !isHost &&
        isLocalPlayer &&
        side === "right" &&
        dataChannelStatus === "open" &&
        gameStatus === "playing";

      if (!shouldSendNetworkInput) {
        return;
      }

      const now = Date.now();
      const lastSentAtMs = lastSentAtMsRef.current;

      if (now - lastSentAtMs < SEND_INTERVAL_MS) {
        return;
      }

      if (lastSentYRef.current !== null && lastSentYRef.current === yPercent) {
        return;
      }

      lastSentAtMsRef.current = now;
      lastSentYRef.current = yPercent;

      webRTCService.sendDataChannelMessage({
        type: "paddleMove",
        payload: { y: yPercent },
      } satisfies PaddleMoveMessage);
    },
    [dispatch, side, isHost, isLocalPlayer, dataChannelStatus, gameStatus],
  );

  const computeYPercentFromClientY = useCallback(
    (clientY: number) => {
      const boardElement = document.getElementById("game-board");
      if (!boardElement) return null;

      const rect = boardElement.getBoundingClientRect();
      const relativeY = clientY - rect.top;
      const percent = (relativeY / rect.height) * boardHeight;
      const centeredPercent = percent - paddleHeight / 2;
      return clampYPercent(centeredPercent);
    },
    [boardHeight, clampYPercent, paddleHeight],
  );

  const handlePointerMove = useCallback(
    (clientY: number) => {
      const yPercent = computeYPercentFromClientY(clientY);
      if (yPercent === null) return;
      updatePaddlePosition(yPercent);
    },
    [computeYPercentFromClientY, updatePaddlePosition],
  );

  const stopDragging = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    if (!isLocalPlayer) return;
    if (gameStatus !== "playing" && gameStatus !== "paused") return;

    const onMouseMove = (event: MouseEvent) => {
      if (!isDraggingRef.current) return;
      handlePointerMove(event.clientY);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!isDraggingRef.current) return;
      if (event.touches.length === 0) return;
      handlePointerMove(event.touches[0].clientY);
    };

    const onMouseUp = () => stopDragging();
    const onTouchEnd = () => stopDragging();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [isLocalPlayer, gameStatus, handlePointerMove, stopDragging]);

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      if (!isLocalPlayer) return;
      if (gameStatus !== "playing" && gameStatus !== "paused") return;
      isDraggingRef.current = true;
      handlePointerMove(event.clientY);
    },
    [isLocalPlayer, gameStatus, handlePointerMove],
  );

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent) => {
      if (!isLocalPlayer) return;
      if (gameStatus !== "playing" && gameStatus !== "paused") return;
      if (event.touches.length === 0) return;
      isDraggingRef.current = true;
      handlePointerMove(event.touches[0].clientY);
    },
    [isLocalPlayer, gameStatus, handlePointerMove],
  );

  return { handleMouseDown, handleTouchStart };
};
