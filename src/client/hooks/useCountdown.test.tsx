import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import gameReducer, { setGameStatus, setCountdown, GameStatus } from '@/store/slices/gameSlice';
import { useCountdown } from './useCountdown';

// Mock timer functions
vi.useFakeTimers();

describe('useCountdown', () => {
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

  const wrapper = ({ children }: { children: React.ReactNode }) => {
    const store = createMockStore();
    return <Provider store={store}>{children}</Provider>;
  };

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should start countdown when status is countdown', () => {
    const store = createMockStore({ status: 'countdown', countdown: 5 });
    
    renderHook(() => useCountdown(), {
      wrapper: ({ children }) => (
        <Provider store={store}>{children}</Provider>
      ),
    });

    // Fast-forward 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(store.getState().game.countdown).toBe(4);
  });

  it('should not countdown when status is not countdown', () => {
    const store = createMockStore({ status: 'playing', countdown: 5 });
    
    renderHook(() => useCountdown(), {
      wrapper: ({ children }) => (
        <Provider store={store}>{children}</Provider>
      ),
    });

    // Fast-forward 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(store.getState().game.countdown).toBe(5);
  });

  it('should change status to playing when countdown reaches 0', () => {
    const store = createMockStore({ status: 'countdown', countdown: 1 });
    
    renderHook(() => useCountdown(), {
      wrapper: ({ children }) => (
        <Provider store={store}>{children}</Provider>
      ),
    });

    // Fast-forward 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(store.getState().game.status).toBe('playing');
  });

  it('should clear interval on unmount', () => {
    const store = createMockStore({ status: 'countdown', countdown: 5 });
    
    const { unmount } = renderHook(() => useCountdown(), {
      wrapper: ({ children }) => (
        <Provider store={store}>{children}</Provider>
      ),
    });

    // Fast-forward 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(store.getState().game.countdown).toBe(4);

    unmount();

    // Fast-forward another second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Countdown should not have changed after unmount
    expect(store.getState().game.countdown).toBe(4);
  });
}); 