import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { webRTCService } from "@/services/webRTCService";
import {
  setCountdown,
  setGameStatus,
  setLastSnapshotTimestamp,
} from "@/store/slices/gameSlice";
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

    const bothReady = gameState.isReady && gameState.opponentReady;

    if (gameState.status === "waiting" && bothReady) {
      dispatch(setCountdown(5));
      dispatch(setGameStatus("countdown"));
      return;
    }

    if (gameState.status === "countdown" && !bothReady) {
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
      dispatch(setLastSnapshotTimestamp(message.timestamp));
    }, BROADCAST_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isHost, dataChannelStatus, dispatch]);
};
