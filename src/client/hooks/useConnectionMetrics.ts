import { useEffect, useMemo, useRef, useState } from "react";
import { useAppSelector } from "@/store/hooks";

export interface ConnectionMetrics {
  roleLabel: string;
  snapshotRateHz: number | null;
  averageSnapshotIntervalMs: number | null;
  snapshotStalenessMs: number | null;
  inputSendRateHz: number | null;
  lastInputSentAtMs: number | null;
  qualityLabel: "Good" | "OK" | "Poor" | "Unknown";
}

const INPUT_SEND_WINDOW_MS = 2000;

const guestInputSentAtMs: number[] = [];

export function recordGuestInputSent(timestampMs: number = Date.now()): void {
  guestInputSentAtMs.push(timestampMs);
  const cutoffMs = timestampMs - INPUT_SEND_WINDOW_MS;
  while (guestInputSentAtMs.length > 0 && guestInputSentAtMs[0] < cutoffMs) {
    guestInputSentAtMs.shift();
  }
}

export function useConnectionMetrics(): ConnectionMetrics {
  const { isHost, dataChannelStatus, peerStatus } = useAppSelector(
    (state) => state.connection,
  );
  const lastSnapshotTimestampMs = useAppSelector(
    (state) => state.game.lastSnapshotTimestampMs,
  );

  const previousSnapshotTimestampRef = useRef<number | null>(null);
  const recentSnapshotIntervalsRef = useRef<number[]>([]);
  const lastSnapshotTimestampRef = useRef<number | null>(null);

  const [snapshotRateHz, setSnapshotRateHz] = useState<number | null>(null);
  const [averageSnapshotIntervalMs, setAverageSnapshotIntervalMs] = useState<
    number | null
  >(null);
  const [snapshotStalenessMs, setSnapshotStalenessMs] = useState<number | null>(
    null,
  );

  const [inputSendRateHz, setInputSendRateHz] = useState<number | null>(null);
  const [lastInputSentAtMs, setLastInputSentAtMs] = useState<number | null>(
    null,
  );

  useEffect(() => {
    lastSnapshotTimestampRef.current = lastSnapshotTimestampMs;

    if (lastSnapshotTimestampMs === null) {
      return;
    }

    const previousTimestampMs = previousSnapshotTimestampRef.current;
    previousSnapshotTimestampRef.current = lastSnapshotTimestampMs;

    if (previousTimestampMs === null) {
      return;
    }

    const intervalMs = lastSnapshotTimestampMs - previousTimestampMs;
    if (intervalMs <= 0) {
      return;
    }

    recentSnapshotIntervalsRef.current.push(intervalMs);
    if (recentSnapshotIntervalsRef.current.length > 20) {
      recentSnapshotIntervalsRef.current.shift();
    }

    const intervals = recentSnapshotIntervalsRef.current;
    const averageMs =
      intervals.reduce((acc, value) => acc + value, 0) / intervals.length;

    setAverageSnapshotIntervalMs(averageMs);
    setSnapshotRateHz(averageMs > 0 ? 1000 / averageMs : null);
  }, [isHost, lastSnapshotTimestampMs]);

  useEffect(() => {
    const isConnected =
      peerStatus === "connected" && dataChannelStatus === "open";

    if (isConnected) {
      return;
    }

    previousSnapshotTimestampRef.current = null;
    recentSnapshotIntervalsRef.current = [];

    setSnapshotRateHz(null);
    setAverageSnapshotIntervalMs(null);
    setSnapshotStalenessMs(null);
    setInputSendRateHz(null);
    setLastInputSentAtMs(null);
    guestInputSentAtMs.length = 0;
  }, [peerStatus, dataChannelStatus]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const latestSnapshotTimestampMs = lastSnapshotTimestampRef.current;

      if (latestSnapshotTimestampMs === null) {
        setSnapshotStalenessMs(null);
      } else {
        setSnapshotStalenessMs(Date.now() - latestSnapshotTimestampMs);
      }

      if (guestInputSentAtMs.length === 0) {
        setInputSendRateHz(null);
        setLastInputSentAtMs(null);
      } else {
        const mostRecentInputMs =
          guestInputSentAtMs[guestInputSentAtMs.length - 1];
        const cutoffMs = Date.now() - INPUT_SEND_WINDOW_MS;
        const recentCount = guestInputSentAtMs.filter(
          (timestampMs) => timestampMs >= cutoffMs,
        ).length;

        setLastInputSentAtMs(mostRecentInputMs);
        setInputSendRateHz(recentCount / (INPUT_SEND_WINDOW_MS / 1000));
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, []);

  const qualityLabel = useMemo<ConnectionMetrics["qualityLabel"]>(() => {
    if (peerStatus !== "connected" || dataChannelStatus !== "open") {
      return "Unknown";
    }

    if (snapshotStalenessMs === null || averageSnapshotIntervalMs === null) {
      return "Unknown";
    }

    if (snapshotStalenessMs < 120 && averageSnapshotIntervalMs < 80) {
      return "Good";
    }
    if (snapshotStalenessMs < 250 || averageSnapshotIntervalMs < 140) {
      return "OK";
    }
    return "Poor";
  }, [
    isHost,
    snapshotStalenessMs,
    averageSnapshotIntervalMs,
    peerStatus,
    dataChannelStatus,
  ]);

  const roleLabel =
    isHost === true ? "Host" : isHost === false ? "Guest" : "Unknown";

  return {
    roleLabel,
    snapshotRateHz,
    averageSnapshotIntervalMs,
    snapshotStalenessMs,
    inputSendRateHz: isHost === false ? inputSendRateHz : null,
    lastInputSentAtMs: isHost === false ? lastInputSentAtMs : null,
    qualityLabel,
  };
}
