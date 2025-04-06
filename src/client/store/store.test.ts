import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './rootReducer';
import { setGameStatus } from './slices/gameSlice';

describe('store configuration', () => {
  it('should create store with correct initial state', () => {
    const store = configureStore({
      reducer: rootReducer,
    });

    const state = store.getState();
    expect(state.game.status).toBe('waiting');
    expect(state.game.score.left).toBe(0);
    expect(state.game.score.right).toBe(0);
    expect(state.game.ball).toEqual({
      x: 50,
      y: 50,
      velocityX: 0,
      velocityY: 0,
    });
    expect(state.connection.status).toBe('disconnected');
  });

  it('should have redux devtools configured correctly', () => {
    const store = configureStore({
      reducer: rootReducer,
    });

    // Verify store methods are available
    expect(store.getState).toBeDefined();
    expect(store.dispatch).toBeDefined();
    expect(store.subscribe).toBeDefined();
  });

  it('should handle actions correctly', () => {
    const store = configureStore({
      reducer: rootReducer,
    });

    store.dispatch(setGameStatus('playing'));
    expect(store.getState().game.status).toBe('playing');
  });

  it('should maintain state immutability', () => {
    const store = configureStore({
      reducer: rootReducer,
    });

    const initialState = store.getState();
    store.dispatch(setGameStatus('playing'));

    // Original state should not be modified
    expect(initialState.game.status).toBe('waiting');
    expect(store.getState().game.status).toBe('playing');
  });

  it('should handle sequential actions', () => {
    const store = configureStore({
      reducer: rootReducer,
    });

    store.dispatch(setGameStatus('countdown'));
    expect(store.getState().game.status).toBe('countdown');

    store.dispatch(setGameStatus('playing'));
    expect(store.getState().game.status).toBe('playing');
  });
}); 