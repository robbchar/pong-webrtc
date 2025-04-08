import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import App from './App';
import gameReducer, { GameStatus } from '@/store/slices/gameSlice';
import connectionReducer from '@/store/slices/connectionSlice';

const createTestStore = () => {
  const defaultGameState = {
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
    wins: {
      left: 0,
      right: 0,
    },
    countdown: 5,
    isReady: false,
  };

  return configureStore({
    reducer: {
      game: gameReducer,
      connection: connectionReducer,
    },
    preloadedState: {
      game: defaultGameState,
    },
  });
};

describe('App', () => {
  it('renders the game title', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    expect(screen.getByText('Pong WebRTC')).toBeInTheDocument();
  });

  it('renders the game board', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    expect(screen.getByTestId('game-board')).toBeInTheDocument();
  });
}); 