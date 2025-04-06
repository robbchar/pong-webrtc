import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import App from './App';
import gameReducer from '@/store/slices/gameSlice';
import connectionReducer from '@/store/slices/connectionSlice';

const createTestStore = () => {
  return configureStore({
    reducer: {
      game: gameReducer,
      connection: connectionReducer,
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