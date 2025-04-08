import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useCountdown } from './useCountdown';
import gameReducer from '@/store/slices/gameSlice';
import { GameStatus } from '@/store/slices/gameSlice';

const createMockStore = (initialState: Partial<{
  status: GameStatus;
  ball: { x: number; y: number; velocityX: number; velocityY: number };
  leftPaddle: { y: number };
  rightPaddle: { y: number };
  score: { left: number; right: number };
  countdown: number;
  isReady: boolean;
}> = {}) => {
  return configureStore({
    reducer: {
      game: gameReducer,
    },
    preloadedState: {
      game: {
        status: 'waiting' as GameStatus,
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
        countdown: 5,
        isReady: false,
        ...initialState,
      },
    },
  });
};

describe('useCountdown', () => {
  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should start countdown when status is countdown', () => {
    vi.useFakeTimers();
    const store = createMockStore({ status: 'countdown', countdown: 5 });
    const { result } = renderHook(() => useCountdown(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    expect(result.current).toBe(5);
    vi.advanceTimersByTime(1000);
    expect(store.getState().game.countdown).toBe(4);
  });

  it('should not progress countdown when status is not countdown', () => {
    vi.useFakeTimers();
    const store = createMockStore({ status: 'waiting', countdown: 5 });
    const { result } = renderHook(() => useCountdown(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    expect(result.current).toBe(5);
    vi.advanceTimersByTime(1000);
    expect(store.getState().game.countdown).toBe(5);
  });

  it('should change game status to playing when countdown reaches zero', () => {
    vi.useFakeTimers();
    const store = createMockStore({ status: 'countdown', countdown: 1 });
    renderHook(() => useCountdown(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    vi.advanceTimersByTime(1000);
    expect(store.getState().game.status).toBe('playing');
  });

  it('should clear interval when unmounted', () => {
    vi.useFakeTimers();
    const store = createMockStore({ status: 'countdown', countdown: 5 });
    const { unmount } = renderHook(() => useCountdown(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    unmount();
    vi.advanceTimersByTime(1000);
    expect(store.getState().game.countdown).toBe(5);
  });
}); 