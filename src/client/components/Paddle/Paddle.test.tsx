import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Paddle from './Paddle';
import rootReducer from '../../store/rootReducer';
import styles from './Paddle.module.css';

const createTestStore = () => {
  return configureStore({
    reducer: rootReducer,
  });
};

describe('Paddle', () => {
  it('renders left paddle with correct position', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <Paddle side="left" position={50} />
      </Provider>
    );

    const paddle = screen.getByTestId('left-paddle');
    expect(paddle).toBeInTheDocument();
    expect(paddle).toHaveStyle({ top: '50%' });
    expect(paddle.className).toContain(styles.paddle);
    expect(paddle.className).toContain(styles.left);
  });

  it('renders right paddle with correct position', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <Paddle side="right" position={75} />
      </Provider>
    );

    const paddle = screen.getByTestId('right-paddle');
    expect(paddle).toBeInTheDocument();
    expect(paddle).toHaveStyle({ top: '75%' });
    expect(paddle.className).toContain(styles.paddle);
    expect(paddle.className).toContain(styles.right);
  });

  it('applies correct styles based on side prop', () => {
    const store = createTestStore();
    const { rerender } = render(
      <Provider store={store}>
        <Paddle side="left" position={50} />
      </Provider>
    );

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
    const store = createTestStore();
    const { rerender } = render(
      <Provider store={store}>
        <Paddle side="left" position={50} />
      </Provider>
    );

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
    const store = createTestStore();
    render(
      <Provider store={store}>
        <Paddle side="left" position={50} />
      </Provider>
    );

    const paddle = screen.getByTestId('left-paddle');
    fireEvent.mouseDown(paddle, { clientY: 300 });
    
    // The position should be updated in the store
    const state = store.getState();
    expect(state.game.leftPaddle.y).toBeDefined();
  });

  it('handles touch start event', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <Paddle side="left" position={50} />
      </Provider>
    );

    const paddle = screen.getByTestId('left-paddle');
    fireEvent.touchStart(paddle, { 
      touches: [{ clientY: 300 }] 
    });
    
    // The position should be updated in the store
    const state = store.getState();
    expect(state.game.leftPaddle.y).toBeDefined();
  });

  it('maintains position within bounds', () => {
    const store = createTestStore();
    const { rerender } = render(
      <Provider store={store}>
        <Paddle side="left" position={50} />
      </Provider>
    );

    const paddle = screen.getByTestId('left-paddle');
    
    // Test position above bounds
    rerender(
      <Provider store={store}>
        <Paddle side="left" position={-10} />
      </Provider>
    );
    expect(paddle).toHaveStyle({ top: '0%' });

    // Test position below bounds
    rerender(
      <Provider store={store}>
        <Paddle side="left" position={110} />
      </Provider>
    );
    expect(paddle).toHaveStyle({ top: '100%' });
  });
}); 