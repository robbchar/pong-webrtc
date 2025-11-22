import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { webRTCService } from "@/services/webRTCService";
import { setCountdown, setGameStatus } from "@/store/slices/gameSlice";
import type { HostGameStateMessage } from "@/types/dataChannelTypes";

const BROADCAST_INTERVAL_MS = 50;

export const useHostGameStateBroadcast = (isHost: boolean) => {
  const dispatch = useDispatch();
  const dataChannelStatus = useSelector(
    (state: RootState) => state.connection.dataChannelStatus,
  );
  const gameState = useSelector((state: RootState) => state.game);
  const latestGameStateRef = useRef(gameState);

  useEffect(() => {
    latestGameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    if (!isHost) return;
    if (dataChannelStatus !== "open") return;

    if (
      gameState.status === "waiting" &&
      gameState.isReady &&
      gameState.opponentReady
    ) {
      dispatch(setCountdown(5));
      dispatch(setGameStatus("countdown"));
    }

    if (
      gameState.status === "countdown" &&
      (!gameState.isReady || !gameState.opponentReady)
    ) {
      dispatch(setGameStatus("waiting"));
      dispatch(setCountdown(5));
    }
  }, [
    isHost,
    dataChannelStatus,
    gameState.status,
    gameState.isReady,
    gameState.opponentReady,
    dispatch,
  ]);

  useEffect(() => {
    if (!isHost) return;
    if (dataChannelStatus !== "open") return;

    const intervalId = window.setInterval(() => {
      const payload = latestGameStateRef.current;
      const message: HostGameStateMessage = {
        type: "gameState",
        payload,
        timestamp: Date.now(),
      };
      webRTCService.sendDataChannelMessage(message);
    }, BROADCAST_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isHost, dataChannelStatus]);
};
