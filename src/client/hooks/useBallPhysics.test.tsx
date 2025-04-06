import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { useBallPhysics } from './useBallPhysics';
import gameReducer, { updateBall } from '../redux/slices/gameSlice';
import connectionReducer from '../redux/slices/connectionSlice';
import { RootState } from '../redux/store';
import React from 'react';

describe('useBallPhysics', () => {
  const rootReducer = combineReducers({
    game: gameReducer,
    connection: connectionReducer
  });

  const mockStore = configureStore({
    reducer: rootReducer,
    preloadedState: {
      game: {
        status: 'playing',
        ball: { x: 400, y: 300, vx: 5, vy: 0 },
        leftPaddle: { y: 250 },
        rightPaddle: { y: 250 },
        scores: { left: 0, right: 0 },
        countdown: 5
      },
      connection: {
        status: 'connected'
      }
    } as RootState
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
    vi.spyOn(performance, 'now').mockImplementation(() => currentTime);
    
    // Mock requestAnimationFrame to store the callback
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback) => {
        animationCallback = callback;
        return 1; // Return a dummy frame ID
      }
    );
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

  it('should initialize with the ball position from the store', () => {
    const { result } = renderHook(() => useBallPhysics(), { wrapper: Wrapper });
    
    expect(result.current.position).toBeDefined();
    expect(result.current.velocity).toBeDefined();
  });

  it('should update ball position based on velocity', () => {
    renderHook(() => useBallPhysics({
      boardWidth: 800,
      boardHeight: 600,
      initialSpeed: 5
    }), { wrapper: Wrapper });

    // First frame initializes lastUpdateRef
    advanceAnimationFrame();
    // Second frame updates position
    advanceAnimationFrame();

    const state = mockStore.getState();
    expect(state.game.ball.x).toBe(405); // Should have moved 5 units right
  });

  it('should handle wall collisions', () => {
    renderHook(() => useBallPhysics({
      boardWidth: 800,
      boardHeight: 600
    }), { wrapper: Wrapper });

    // First frame initializes
    advanceAnimationFrame();

    // Move ball to top wall
    act(() => {
      mockStore.dispatch(updateBall({ x: 400, y: 0, vx: 0, vy: -5 }));
    });

    // Let the hook process the state update
    advanceAnimationFrame();

    const state = mockStore.getState();
    expect(state.game.ball.vy).toBe(5); // Should bounce down
  });

  it('should handle paddle collisions', () => {
    renderHook(() => useBallPhysics({
      boardWidth: 800,
      boardHeight: 600,
      paddleWidth: 20,
      paddleHeight: 100
    }), { wrapper: Wrapper });

    // First frame initializes
    advanceAnimationFrame();

    // Move ball to left paddle
    act(() => {
      mockStore.dispatch(updateBall({ x: 20, y: 300, vx: -5, vy: 0 }));
    });

    // Let the hook process the state update
    advanceAnimationFrame();

    const state = mockStore.getState();
    expect(state.game.ball.vx).toBe(5); // Should bounce right
  });

  it('should handle scoring', () => {
    renderHook(() => useBallPhysics({
      boardWidth: 800,
      boardHeight: 600
    }), { wrapper: Wrapper });

    // First frame initializes
    advanceAnimationFrame();

    // Move ball past right paddle
    act(() => {
      mockStore.dispatch(updateBall({ x: 810, y: 300, vx: 5, vy: 0 }));
    });

    // Let the hook process the state update
    advanceAnimationFrame();

    const state = mockStore.getState();
    expect(state.game.scores.left).toBe(1); // Left player should score
  });

  it('should clean up animation frame on unmount', () => {
    const clearTimeout = vi.spyOn(window, 'clearTimeout');
    const { unmount } = renderHook(() => useBallPhysics(), { wrapper: Wrapper });

    // First frame initializes
    advanceAnimationFrame();

    unmount();

    expect(clearTimeout).toHaveBeenCalled();
  });
}); 