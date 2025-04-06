/// <reference types="jest" />
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import gameReducer from '../redux/slices/gameSlice';
import { usePaddleMovement } from './usePaddleMovement';

interface GameState {
  status: 'lobby' | 'countdown' | 'playing' | 'paused' | 'gameOver';
  ball: { x: number; y: number; vx: number; vy: number };
  leftPaddle: { y: number };
  rightPaddle: { y: number };
  scores: { left: number; right: number };
  countdown: number;
}

// Extend Window interface to include our test helper
declare global {
  interface Window {
    triggerAnimationFrame?: (time?: number) => void;
  }
}

describe('usePaddleMovement', () => {
  const mockStore = configureStore({
    reducer: {
      game: gameReducer,
    },
    preloadedState: {
      game: {
        status: 'playing' as const,
        ball: { x: 50, y: 50, vx: 5, vy: 5 },
        leftPaddle: { y: 50 },
        rightPaddle: { y: 50 },
        scores: { left: 0, right: 0 },
        countdown: 5,
      } as GameState,
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={mockStore}>{children}</Provider>
  );

  const triggerFrame = (time: number = performance.now()) => {
    if (!window.triggerAnimationFrame) {
      throw new Error('triggerAnimationFrame not initialized');
    }
    window.triggerAnimationFrame(time);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    // Mock requestAnimationFrame
    let frameId = 0;
    let lastCallback: ((time: number) => void) | null = null;

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      frameId++;
      lastCallback = cb;
      return frameId;
    });

    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      lastCallback = null;
    });

    // Helper to trigger animation frame
    window.triggerAnimationFrame = (time: number = performance.now()) => {
      if (lastCallback) {
        lastCallback(time);
      }
    };

    // Mock performance.now
    vi.spyOn(performance, 'now').mockReturnValue(0);
    // Mock canvas element with getBoundingClientRect
    document.body.innerHTML = '<div id="game-canvas"></div>';
    const canvas = document.getElementById('game-canvas')!;
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete window.triggerAnimationFrame;
  });

  it('should initialize with correct paddle position', () => {
    const { result } = renderHook(() => usePaddleMovement('left'), {
      wrapper: Wrapper,
    });

    expect(result.current.isMoving).toBe(false);
  });

  it('should handle mouse movement', async () => {
    const { result } = renderHook(() => usePaddleMovement('left'), {
      wrapper: Wrapper,
    });

    const canvas = document.getElementById('game-canvas')!;
    
    // Start movement
    await act(async () => {
      result.current.startMovement();
      canvas.dispatchEvent(new MouseEvent('mousedown'));
      triggerFrame(16);
    });

    expect(result.current.isMoving).toBe(true);

    // Move paddle
    await act(async () => {
      canvas.dispatchEvent(
        new MouseEvent('mousemove', {
          clientY: 100,
          bubbles: true,
        })
      );
      // Run multiple frames to allow for smooth movement
      triggerFrame(32);
      triggerFrame(48);
    });

    const state = mockStore.getState();
    expect(state.game.leftPaddle.y).toBeGreaterThan(50); // Position should have increased

    // Stop movement
    await act(async () => {
      result.current.stopMovement();
      canvas.dispatchEvent(new MouseEvent('mouseup'));
      triggerFrame(64);
    });

    expect(result.current.isMoving).toBe(false);
  });

  it('should handle touch movement', async () => {
    const { result } = renderHook(() => usePaddleMovement('right'), {
      wrapper: Wrapper,
    });

    const canvas = document.getElementById('game-canvas')!;
    
    // Start movement
    await act(async () => {
      result.current.startMovement();
      canvas.dispatchEvent(new TouchEvent('touchstart', {
        touches: [{ clientY: 50 } as Touch],
        bubbles: true,
      }));
      triggerFrame(16);
    });

    expect(result.current.isMoving).toBe(true);

    // Move paddle
    await act(async () => {
      canvas.dispatchEvent(
        new TouchEvent('touchmove', {
          touches: [{ clientY: 150 } as Touch],
          bubbles: true,
        })
      );
      // Run multiple frames to allow for smooth movement
      triggerFrame(32);
      triggerFrame(48);
    });

    const state = mockStore.getState();
    expect(state.game.rightPaddle.y).toBeGreaterThan(50); // Position should have increased

    // Stop movement
    await act(async () => {
      result.current.stopMovement();
      canvas.dispatchEvent(new TouchEvent('touchend'));
      triggerFrame(64);
    });

    expect(result.current.isMoving).toBe(false);
  });

  it('should clean up on unmount', async () => {
    const spy = vi.spyOn(window, 'cancelAnimationFrame');
    
    const { unmount } = renderHook(() => usePaddleMovement('left'), {
      wrapper: Wrapper,
    });

    // Advance one frame to start the animation
    triggerFrame(16);

    unmount();
    
    expect(spy).toHaveBeenCalled();
  });
}); 