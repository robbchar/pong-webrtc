/// <reference types="jest" />
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import gameReducer, { GameState } from "@/store/slices/gameSlice";
import connectionReducer, {
  ConnectionState,
} from "@/store/slices/connectionSlice";
import { SignalingStatus } from "@/types/signalingTypes";
import { usePaddleMovement } from "./usePaddleMovement";

// Extend Window interface to include our test helper
declare global {
  interface Window {
    triggerAnimationFrame?: (time?: number) => void;
  }
}

describe("usePaddleMovement", () => {
  // Function to create store for each test, allowing overrides
  const createTestStore = (
    overrides: Partial<{
      game: Partial<GameState>;
      connection: Partial<ConnectionState>;
    }> = {},
  ) => {
    const defaultGameState: GameState = {
      status: "playing", // Default to playing for movement tests
      ball: { x: 50, y: 50, velocityX: 5, velocityY: 5 },
      leftPaddle: { y: 50 },
      rightPaddle: { y: 50 },
      score: { left: 0, right: 0 },
      wins: { left: 0, right: 0 },
      countdown: 5,
      isReady: false,
    };
    const defaultConnectionState: ConnectionState = {
      signalingStatus: SignalingStatus.CLOSED,
      peerStatus: "idle",
      dataChannelStatus: "closed",
      peerId: null,
      isHost: false,
      error: null,
    };
    return configureStore({
      reducer: {
        game: gameReducer,
        connection: connectionReducer,
      },
      preloadedState: {
        game: { ...defaultGameState, ...(overrides.game || {}) },
        connection: {
          ...defaultConnectionState,
          ...(overrides.connection || {}),
        },
      },
    });
  };

  let mockStore = createTestStore();
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={mockStore}>{children}</Provider>
  );

  const triggerFrame = (time: number = performance.now()) => {
    if (!window.triggerAnimationFrame) {
      throw new Error("triggerAnimationFrame not initialized");
    }
    window.triggerAnimationFrame(time);
  };

  beforeEach(() => {
    mockStore = createTestStore();
    dispatchSpy = vi.spyOn(mockStore, "dispatch");
    vi.useFakeTimers();

    let frameId = 0;
    let lastCallback: ((time: number) => void) | null = null;

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frameId++;
      lastCallback = cb;
      return frameId;
    });

    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {
      lastCallback = null;
    });

    // Helper to trigger animation frame
    window.triggerAnimationFrame = (time: number = performance.now()) => {
      if (lastCallback) {
        lastCallback(time);
      }
    };

    // Mock performance.now
    vi.spyOn(performance, "now").mockReturnValue(0);
    // Mock canvas element with getBoundingClientRect
    document.body.innerHTML = '<div id="game-canvas"></div>';
    const canvas = document.getElementById("game-canvas")!;
    canvas.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 0,
      left: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
    });
  });

  afterEach(() => {
    dispatchSpy.mockRestore(); // Restore the spy
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    delete window.triggerAnimationFrame;
  });

  it("should initialize with correct paddle position", () => {
    const { result } = renderHook(() => usePaddleMovement("left"), {
      wrapper: Wrapper,
    });

    expect(result.current.isMoving).toBe(false);
  });

  it("should handle mouse movement", async () => {
    const { result } = renderHook(() => usePaddleMovement("left"), {
      wrapper: Wrapper,
    });

    const canvas = document.getElementById("game-canvas")!;

    // Start movement in its own act
    await act(async () => {
      result.current.startMovement();
    });
    // Simulate mousedown (might not be strictly necessary if startMovement covers it)
    await act(async () => {
      canvas.dispatchEvent(new MouseEvent("mousedown"));
    });

    expect(result.current.isMoving).toBe(true);

    // Move paddle and trigger frames in another act
    await act(async () => {
      canvas.dispatchEvent(
        new MouseEvent("mousemove", {
          clientY: 100,
          bubbles: true,
        }),
      );
      // Run multiple frames to allow for smooth movement
      triggerFrame(16); // Corresponds to time = 16ms
      triggerFrame(32); // Corresponds to time = 32ms
      triggerFrame(48); // Corresponds to time = 48ms
    });

    // Assert dispatch was called with the correct action type
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "game/updatePaddle",
        payload: { player: "left", position: expect.any(Number) },
      }),
    );

    // Stop movement
    await act(async () => {
      result.current.stopMovement();
      canvas.dispatchEvent(new MouseEvent("mouseup"));
      triggerFrame(64);
    });

    expect(result.current.isMoving).toBe(false);
  });

  it("should handle touch movement", async () => {
    const { result } = renderHook(() => usePaddleMovement("right"), {
      wrapper: Wrapper,
    });

    const canvas = document.getElementById("game-canvas")!;

    // Start movement in its own act
    await act(async () => {
      result.current.startMovement();
    });
    // Simulate touchstart
    await act(async () => {
      canvas.dispatchEvent(
        new TouchEvent("touchstart", {
          touches: [{ clientY: 50 } as Touch],
          bubbles: true,
        }),
      );
    });

    expect(result.current.isMoving).toBe(true);

    // Move paddle and trigger frames in another act
    await act(async () => {
      canvas.dispatchEvent(
        new TouchEvent("touchmove", {
          touches: [{ clientY: 150 } as Touch],
          bubbles: true,
        }),
      );
      // Run multiple frames to allow for smooth movement
      triggerFrame(16);
      triggerFrame(32);
      triggerFrame(48);
    });

    // Assert dispatch was called
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "game/updatePaddle",
        payload: { player: "right", position: expect.any(Number) },
      }),
    );

    // Stop movement
    await act(async () => {
      result.current.stopMovement();
      canvas.dispatchEvent(new TouchEvent("touchend"));
      triggerFrame(64);
    });

    expect(result.current.isMoving).toBe(false);
  });

  it("should clean up on unmount", async () => {
    const spy = vi.spyOn(window, "cancelAnimationFrame");

    const { unmount } = renderHook(() => usePaddleMovement("left"), {
      wrapper: Wrapper,
    });

    // Advance one frame to start the animation
    triggerFrame(16);

    unmount();

    expect(spy).toHaveBeenCalled();
  });
});
