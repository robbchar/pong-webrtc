import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { useBallPhysics } from "./useBallPhysics";
import gameReducer, { updateBall, GameStatus } from "../store/slices/gameSlice";
import connectionReducer from "@/store/slices/connectionSlice";
import { RootState } from "@/store/store";
import React from "react";

describe("useBallPhysics", () => {
  const rootReducer = combineReducers({
    game: gameReducer,
    connection: connectionReducer,
  });

  const mockStore = configureStore({
    reducer: rootReducer,
    preloadedState: {
      game: {
        status: "playing" as GameStatus,
        ball: { x: 50, y: 50, velocityX: 5, velocityY: 0 },
        leftPaddle: { y: 50 },
        rightPaddle: { y: 50 },
        score: { left: 0, right: 0 },
        wins: { left: 0, right: 0 },
        countdown: 5,
        isReady: false,
        opponentReady: false,
        lastSnapshotTimestampMs: null,
      },
      connection: {
        signalingStatus: "open",
        peerStatus: "connected",
        peerId: "test-peer",
        isHost: true,
        playerSide: "left",
        gameId: "test-game",
        dataChannelStatus: "open",
        error: null,
        selfStartIntent: false,
        opponentStartIntent: false,
      },
    } as RootState,
  });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <Provider store={mockStore}>{children}</Provider>
  );

  let currentTime = 0;
  let animationCallback: ((timestamp: number) => void) | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    currentTime = 0;
    animationCallback = null;

    // Mock performance.now() to return our controlled timestamp
    vi.spyOn(performance, "now").mockImplementation(() => currentTime);

    // Mock requestAnimationFrame to store the callback
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      animationCallback = callback;
      return 1; // Return a dummy frame ID
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    animationCallback = null;
  });

  const advanceAnimationFrame = () => {
    if (animationCallback) {
      currentTime += 16;
      act(() => {
        animationCallback!(currentTime);
      });
    }
  };

  it("should initialize with the ball and paddles from the store", () => {
    const { result } = renderHook(() => useBallPhysics(), { wrapper: Wrapper });

    expect(result.current.ball).toBeDefined();
    expect(result.current.leftPaddle).toBeDefined();
    expect(result.current.rightPaddle).toBeDefined();
  });

  it("should update ball position based on velocity", () => {
    renderHook(() => useBallPhysics(), { wrapper: Wrapper });

    // First frame initializes lastUpdateRef and updates position
    advanceAnimationFrame();

    const state = mockStore.getState();
    expect(state.game.ball.x).toBe(55); // Should have moved 5 units right
  });

  it("should handle wall collisions", () => {
    renderHook(() => useBallPhysics(), { wrapper: Wrapper });

    // First frame initializes
    advanceAnimationFrame();

    // Move ball to top wall
    act(() => {
      mockStore.dispatch(
        updateBall({ x: 50, y: 0, velocityX: 0, velocityY: -5 }),
      );
    });

    // Let the hook process the state update
    advanceAnimationFrame();

    const state = mockStore.getState();
    expect(state.game.ball.velocityY).toBe(5); // Should bounce down
  });

  it("should handle paddle collisions", () => {
    renderHook(() => useBallPhysics(), { wrapper: Wrapper });

    // First frame initializes
    advanceAnimationFrame();

    // Move ball to left paddle
    act(() => {
      mockStore.dispatch(
        updateBall({ x: 0, y: 50, velocityX: -5, velocityY: 0 }),
      );
    });

    // Let the hook process the state update
    advanceAnimationFrame();

    const state = mockStore.getState();
    // The velocity should be positive after bouncing off the left paddle
    // It will be less than 5 due to the angle calculation
    expect(state.game.ball.velocityX).toBeGreaterThan(0);
    expect(state.game.ball.velocityX).toBeLessThanOrEqual(5);
  });

  it("should handle scoring", () => {
    renderHook(() => useBallPhysics(), { wrapper: Wrapper });

    // First frame initializes
    advanceAnimationFrame();

    // Move ball past right paddle (needs to be at x >= 100 and y far from paddle)
    act(() => {
      mockStore.dispatch(
        updateBall({ x: 101, y: 80, velocityX: 1, velocityY: 0 }),
      );
    });

    // Let the hook process the state update
    advanceAnimationFrame();

    const state = mockStore.getState();
    expect(state.game.score.left).toBe(1); // Left player should score
  });

  it("should clean up animation frame on unmount", () => {
    const cancelAnimationFrame = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = renderHook(() => useBallPhysics(), {
      wrapper: Wrapper,
    });

    // First frame initializes
    advanceAnimationFrame();

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
