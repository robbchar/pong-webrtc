import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import GameBoard from './GameBoard';
import rootReducer from '../../store/rootReducer';
import useDeviceOrientation from '../../hooks/useDeviceOrientation';
import styles from './GameBoard.module.css';

// Mock the useDeviceOrientation hook
vi.mock('../../hooks/useDeviceOrientation', () => ({
  default: vi.fn(() => ({
    isPortrait: true,
    isLandscape: false,
    angle: 0,
  })),
}));

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState: initialState,
  });
};

const renderGameBoard = (initialState = {}) => {
  const store = createTestStore(initialState);
    render(
      <Provider store={store}>
        <GameBoard />
      </Provider>
    );
  }

describe('GameBoard', () => {
  it('renders game board with correct elements', () => {
    renderGameBoard();

    expect(screen.getByTestId('game-board')).toBeInTheDocument();
    expect(screen.getByTestId('center-line')).toBeInTheDocument();
    expect(screen.getByTestId('left-paddle')).toBeInTheDocument();
    expect(screen.getByTestId('right-paddle')).toBeInTheDocument();
    expect(screen.getByTestId('ball')).toBeInTheDocument();
  });

  it('applies portrait styles when in portrait orientation', () => {
    renderGameBoard();

    const gameBoard = screen.getByTestId('game-board');
    expect(gameBoard).toHaveClass(styles.portrait);
  });

  it('applies landscape styles when in landscape orientation', () => {
    // Mock landscape orientation
    (useDeviceOrientation as ReturnType<typeof vi.fn>).mockReturnValue({
      isPortrait: false,
      isLandscape: true,
      angle: 0,
    });

    renderGameBoard();

    const gameBoard = screen.getByTestId('game-board');
    expect(gameBoard).toHaveClass(styles.landscape);
  });

  it('shows ready button in waiting state', () => {
    renderGameBoard({
      game: {
        status: 'waiting',
        ball: { x: 50, y: 50, velocityX: 0, velocityY: 0 },
        leftPaddle: { y: 50 },
        rightPaddle: { y: 50 },
        score: { left: 0, right: 0 },
      },
    });
    expect(screen.getByText('READY')).toBeInTheDocument();
  });

  it('shows countdown in countdown state', () => {
    renderGameBoard({
      game: {
        status: 'countdown',
        ball: { x: 50, y: 50, velocityX: 0, velocityY: 0 },
        leftPaddle: { y: 50 },
        rightPaddle: { y: 50 },
        score: { left: 0, right: 0 },
      },
    });
    expect(screen.getByTestId('countdown')).toBeInTheDocument();
  });

  it('shows game over in game over state', () => {
    renderGameBoard({
      game: {
        status: 'gameOver',
        ball: { x: 50, y: 50, velocityX: 0, velocityY: 0 },
        leftPaddle: { y: 50 },
        rightPaddle: { y: 50 },
        score: { left: 0, right: 0 },
      },
    });
    expect(screen.getByTestId('game-over')).toBeInTheDocument();
  });
}); 