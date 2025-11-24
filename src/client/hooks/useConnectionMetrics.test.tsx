import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import rootReducer from "@/store/rootReducer";
import { useConnectionMetrics } from "./useConnectionMetrics";
import { setLastSnapshotTimestamp } from "@/store/slices/gameSlice";
import {
  setPeerConnected,
  setDataChannelStatus,
} from "@/store/slices/connectionSlice";

describe("useConnectionMetrics", () => {
  let store: ReturnType<typeof configureStore>;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    store = configureStore({ reducer: rootReducer });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const connectAsHost = () => {
    act(() => {
      store.dispatch(setPeerConnected({ peerId: "peer-1", isHost: true }));
      store.dispatch(setDataChannelStatus("open"));
    });
  };

  it("computes snapshot rate and average interval for host from sent timestamps", () => {
    connectAsHost();

    const { result } = renderHook(() => useConnectionMetrics(), {
      wrapper: Wrapper,
    });

    act(() => {
      store.dispatch(setLastSnapshotTimestamp(1000));
    });

    act(() => {
      store.dispatch(setLastSnapshotTimestamp(1050));
    });

    expect(result.current.roleLabel).toBe("Host");
    expect(result.current.averageSnapshotIntervalMs).toBeCloseTo(50, 0);
    expect(result.current.snapshotRateHz).toBeCloseTo(20, 0);
  });

  it("marks quality Unknown until connected and snapshot stats exist", () => {
    const { result } = renderHook(() => useConnectionMetrics(), {
      wrapper: Wrapper,
    });

    expect(result.current.qualityLabel).toBe("Unknown");

    connectAsHost();

    act(() => {
      store.dispatch(setLastSnapshotTimestamp(1000));
    });

    expect(result.current.qualityLabel).toBe("Unknown");

    act(() => {
      store.dispatch(setLastSnapshotTimestamp(1050));
    });

    act(() => {
      vi.setSystemTime(1100);
      vi.advanceTimersByTime(500);
    });

    expect(result.current.qualityLabel).not.toBe("Unknown");
  });

  it("clears snapshot metrics when connection closes", () => {
    connectAsHost();

    const { result } = renderHook(() => useConnectionMetrics(), {
      wrapper: Wrapper,
    });

    act(() => {
      store.dispatch(setLastSnapshotTimestamp(1000));
    });

    act(() => {
      store.dispatch(setLastSnapshotTimestamp(1050));
    });

    expect(result.current.snapshotRateHz).not.toBeNull();

    act(() => {
      store.dispatch(setDataChannelStatus("closed"));
    });

    expect(result.current.snapshotRateHz).toBeNull();
    expect(result.current.averageSnapshotIntervalMs).toBeNull();
    expect(result.current.snapshotStalenessMs).toBeNull();
  });
});
