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

describe("usePaddleMovement", () => {
  const createTestStore = (
    overrides: Partial<{
      game: Partial<GameState>;
      connection: Partial<ConnectionState>;
    }> = {},
  ) => {
    const defaultGameState: GameState = {
      status: "playing",
      ball: { x: 50, y: 50, velocityX: 5, velocityY: 5 },
      leftPaddle: { y: 50 },
      rightPaddle: { y: 50 },
      score: { left: 0, right: 0 },
      wins: { left: 0, right: 0 },
      countdown: 5,
      isReady: false,
      opponentReady: false,
      lastSnapshotTimestampMs: null,
    };

    const defaultConnectionState: ConnectionState = {
      signalingStatus: SignalingStatus.CLOSED,
      peerStatus: "connected",
      dataChannelStatus: "closed",
      peerId: "p1",
      isHost: true,
      playerSide: "left",
      gameId: "g1",
      error: null,
      selfStartIntent: false,
      opponentStartIntent: false,
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

  beforeEach(() => {
    mockStore = createTestStore();
    dispatchSpy = vi.spyOn(mockStore, "dispatch");

    document.body.innerHTML = '<div id="game-board"></div>';
    const board = document.getElementById("game-board")!;
    board.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 0,
      left: 0,
      width: 100,
      height: 100,
      right: 100,
      bottom: 100,
    });
  });

  afterEach(() => {
    dispatchSpy.mockRestore();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("does not dispatch when paddle is not locally controlled", () => {
    const { result } = renderHook(
      () =>
        usePaddleMovement({
          side: "left",
          boardHeight: 100,
          paddleHeight: 15,
          isLocalPlayer: false,
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.handleMouseDown({ clientY: 20 } as any);
    });

    expect(dispatchSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "game/updateLeftPaddle" }),
    );
  });

  it("updates left paddle on host drag", () => {
    const { result } = renderHook(
      () =>
        usePaddleMovement({
          side: "left",
          boardHeight: 100,
          paddleHeight: 15,
          isLocalPlayer: true,
        }),
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.handleMouseDown({ clientY: 30 } as any);
    });

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientY: 40 }));
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "game/updateLeftPaddle",
        payload: expect.any(Number),
      }),
    );
  });
});
