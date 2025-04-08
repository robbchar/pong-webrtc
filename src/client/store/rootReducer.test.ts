import { describe, it, expect } from 'vitest';
import rootReducer from '@/store/rootReducer';
import { setSignalingStatus, ConnectionState } from '@/store/slices/connectionSlice';
import { GameStatus } from '@/store/slices/gameSlice';
import { SignalingStatus } from '@/types/signalingTypes';

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
      signalingStatus: SignalingStatus.CLOSED,
      peerStatus: 'idle',
      peerId: null,
      isHost: false,
      error: null,
    } as ConnectionState,
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

  it('should handle updates to connection state (signalingStatus)', () => {
    const newState = rootReducer(initialState, setSignalingStatus(SignalingStatus.CONNECTING));
    expect(newState.connection.signalingStatus).toBe(SignalingStatus.CONNECTING);
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