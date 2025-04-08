import { describe, it, expect } from 'vitest';
import rootReducer from '@/store/rootReducer';
import { setConnectionStatus } from '@/store/slices/connectionSlice';
import { GameStatus } from '@/store/slices/gameSlice';
import { ConnectionStatus } from '@/store/slices/connectionSlice';

describe('rootReducer', () => {
  const initialState = {
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
      wins: {
        left: 0,
        right: 0,
      },
      countdown: 5,
      isReady: false,
    },
    connection: {
      status: 'disconnected' as ConnectionStatus,
      peerId: null,
      error: null,
    },
  };

  it('should handle initial state', () => {
    expect(rootReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle updates to game state', () => {
    const action = {
      type: 'game/updateBall',
      payload: {
        x: 60,
        y: 40,
        velocityX: 0.5,
        velocityY: -0.5,
      },
    };
    const newState = rootReducer(initialState, action);
    expect(newState.game.ball).toEqual(action.payload);
  });

  it('should handle updates to connection state', () => {
    const newState = rootReducer(initialState, setConnectionStatus('connected'));
    expect(newState.connection.status).toBe('connected');
  });

  it('should maintain state isolation between slices', () => {
    const gameAction = {
      type: 'game/updateBall',
      payload: {
        x: 60,
        y: 40,
        velocityX: 0.5,
        velocityY: -0.5,
      },
    };
    const newState = rootReducer(initialState, gameAction);
    expect(newState.connection).toEqual(initialState.connection);
  });
}); 