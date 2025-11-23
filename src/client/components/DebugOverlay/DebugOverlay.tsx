import React, { useMemo } from "react";
import { useConnectionMetrics } from "@/hooks/useConnectionMetrics";
import styles from "./DebugOverlay.module.css";

const formatHz = (value: number | null) =>
  value === null ? "—" : value.toFixed(1);

const formatMs = (value: number | null) =>
  value === null ? "—" : `${Math.round(value)}ms`;

const DebugOverlay: React.FC = () => {
  const metrics = useConnectionMetrics();

  const qualityClass = useMemo(() => {
    switch (metrics.qualityLabel) {
      case "Good":
        return styles.qualityGood;
      case "OK":
        return styles.qualityOk;
      case "Poor":
        return styles.qualityPoor;
      default:
        return undefined;
    }
  }, [metrics.qualityLabel]);

  const lastInputAgeMs =
    metrics.lastInputSentAtMs === null
      ? null
      : Date.now() - metrics.lastInputSentAtMs;

  return (
    <div className={styles.debugOverlay} data-testid="debug-overlay">
      <div className={styles.row}>
        <span className={styles.label}>Role</span>
        <span className={styles.value}>{metrics.roleLabel}</span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Quality</span>
        <span className={`${styles.value} ${qualityClass ?? ""}`}>
          {metrics.qualityLabel}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Snapshots</span>
        <span className={styles.value}>
          {formatHz(metrics.snapshotRateHz)}Hz
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Avg interval</span>
        <span className={styles.value}>
          {formatMs(metrics.averageSnapshotIntervalMs)}
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Snapshot age</span>
        <span className={styles.value}>
          {formatMs(metrics.snapshotStalenessMs)}
        </span>
      </div>
      {metrics.roleLabel === "Guest" && (
        <>
          <div className={styles.row}>
            <span className={styles.label}>Inputs</span>
            <span className={styles.value}>
              {formatHz(metrics.inputSendRateHz)}Hz
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Input age</span>
            <span className={styles.value}>{formatMs(lastInputAgeMs)}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default DebugOverlay;
