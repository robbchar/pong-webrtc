import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import gameReducer, { GameStatus } from "@/store/slices/gameSlice";
import { useCountdown } from "./useCountdown";

describe("useCountdown", () => {
  let store: ReturnType<typeof configureStore>;

  const createMockStore = (
    initialState: Partial<{
      status: GameStatus;
      countdown: number;
      isReady: boolean;
    }> = {},
  ) => {
    return configureStore({
      reducer: {
        game: gameReducer,
      },
      preloadedState: {
        game: {
          status: "waiting" as GameStatus,
          ball: {
            x: 50,
            y: 50,
            velocityX: 0,
            velocityY: 0,
          },
          leftPaddle: {
            y: 50,
          },
          rightPaddle: {
            y: 50,
          },
          score: {
            left: 0,
            right: 0,
          },
          wins: {
            left: 0,
            right: 0,
          },
          countdown: 5,
          isReady: false,
          ...initialState,
        },
      },
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    store = createMockStore();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("should start countdown when status is countdown", () => {
    store = createMockStore({ status: "countdown", countdown: 5 });
    const { result } = renderHook(() => useCountdown(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    expect(result.current).toBe(5);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(store.getState().game.countdown).toBe(4);
  });

  it("should not progress countdown when status is not countdown", () => {
    store = createMockStore({ status: "waiting", countdown: 5 });
    const { result } = renderHook(() => useCountdown(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    expect(result.current).toBe(5);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(store.getState().game.countdown).toBe(5);
  });

  it("should change game status to playing when countdown reaches zero", () => {
    store = createMockStore({ status: "countdown", countdown: 1 });
    renderHook(() => useCountdown(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(store.getState().game.status).toBe("playing");
  });

  it("should clear interval when unmounted", () => {
    store = createMockStore({ status: "countdown", countdown: 5 });
    const { unmount } = renderHook(() => useCountdown(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(store.getState().game.countdown).toBe(5);
  });
});
