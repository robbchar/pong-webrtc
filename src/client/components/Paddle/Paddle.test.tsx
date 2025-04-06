import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Paddle from './Paddle';
import rootReducer from '../../store/rootReducer';
import styles from './Paddle.module.css';

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState: initialState,
  });
};

const renderPaddle = (side: 'left' | 'right', position: number, store: ReturnType<typeof createTestStore> = createTestStore()) => {
  const { rerender } = render(
    <Provider store={store}>
      <Paddle side={side} position={position} />
    </Provider>
  );
  return { store, rerender };
};

describe('Paddle', () => {
  it('renders left paddle with correct position', () => {
    renderPaddle('left', 50);

    const paddle = screen.getByTestId('left-paddle');
    expect(paddle).toBeInTheDocument();
    expect(paddle).toHaveStyle({ top: '50%' });
    expect(paddle.className).toContain(styles.paddle);
    expect(paddle.className).toContain(styles.left);
  });

  it('renders right paddle with correct position', () => {
    renderPaddle('right', 75);

    const paddle = screen.getByTestId('right-paddle');
    expect(paddle).toBeInTheDocument();
    expect(paddle).toHaveStyle({ top: '75%' });
    expect(paddle.className).toContain(styles.paddle);
    expect(paddle.className).toContain(styles.right);
  });

  it('applies correct styles based on side prop', () => {
    const { store, rerender } = renderPaddle('left', 50);
    const leftPaddle = screen.getByTestId('left-paddle');
    expect(leftPaddle.className).toContain(styles.left);

    rerender(
      <Provider store={store}>
        <Paddle side="right" position={50} />
      </Provider>
    );

    const rightPaddle = screen.getByTestId('right-paddle');
    expect(rightPaddle.className).toContain(styles.right);
  });

  it('updates position when position prop changes', () => {
    const { store, rerender } = renderPaddle('left', 50);
    const paddle = screen.getByTestId('left-paddle');
    expect(paddle).toHaveStyle({ top: '50%' });

    rerender(
      <Provider store={store}>
        <Paddle side="left" position={75} />
      </Provider>
    );

    expect(paddle).toHaveStyle({ top: '75%' });
  });

  it('handles mouse down event', () => {
    const { store } = renderPaddle('left', 50);
    const paddle = screen.getByTestId('left-paddle');
    fireEvent.mouseDown(paddle, { clientY: 300 });
    
    const state = store.getState();
    expect(state.game.leftPaddle.y).toBeDefined();
  });

  it('handles touch start event', () => {
    const { store } = renderPaddle('left', 50);
    const paddle = screen.getByTestId('left-paddle');
    fireEvent.touchStart(paddle, { 
      touches: [{ clientY: 300 }] 
    });
    
    const state = store.getState();
    expect(state.game.leftPaddle.y).toBeDefined();
  });

  it('maintains position within bounds', () => {
    const { store, rerender } = renderPaddle('left', 50);
    const paddle = screen.getByTestId('left-paddle');
    
    rerender(
      <Provider store={store}>
        <Paddle side="left" position={-10} />
      </Provider>
    );
    expect(paddle).toHaveStyle({ top: '0%' });

    rerender(
      <Provider store={store}>
        <Paddle side="left" position={110} />
      </Provider>
    );
    expect(paddle).toHaveStyle({ top: '100%' });
  });
}); 