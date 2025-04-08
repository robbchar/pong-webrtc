import { describe, it, expect } from 'vitest';
import gameReducer, { setGameStatus, updateScore, updateBall, updateLeftPaddle, updateRightPaddle } from './gameSlice';
import { GameStatus } from './gameSlice';

describe('gameSlice', () => {
  const initialState = {
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

  it('should handle initial state', () => {
    expect(gameReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  describe('setGameStatus', () => {
    it('should update game status', () => {
      const newStatus: GameStatus = 'playing';
      const actual = gameReducer(initialState, setGameStatus(newStatus));
      expect(actual.status).toBe(newStatus);
    });

    it('should handle all possible game statuses', () => {
      const statuses: GameStatus[] = ['waiting', 'countdown', 'playing', 'paused', 'gameOver'];
      statuses.forEach(status => {
        const actual = gameReducer(initialState, setGameStatus(status));
        expect(actual.status).toBe(status);
      });
    });
  });

  describe('updateScore', () => {
    it('should update player scores', () => {
      const actual = gameReducer(initialState, updateScore({ player: 'left', points: 3 }));
      expect(actual.score.left).toBe(3);
      expect(actual.score.right).toBe(0);
    });

    it('should not trigger game over when score is less than 10', () => {
      const actual = gameReducer(initialState, updateScore({ player: 'left', points: 9 }));
      expect(actual.score.left).toBe(9);
      expect(actual.status).toBe('waiting');
      expect(actual.wins.left).toBe(0);
    });

    it('should trigger game over and increment wins when score reaches 10', () => {
      const actual = gameReducer(initialState, updateScore({ player: 'left', points: 10 }));
      expect(actual.score.left).toBe(10);
      expect(actual.status).toBe('gameOver');
      expect(actual.wins.left).toBe(1);
    });

    it('should handle multiple wins', () => {
      // First win
      let state = gameReducer(initialState, updateScore({ player: 'left', points: 10 }));
      expect(state.wins.left).toBe(1);

      // Reset game
      state = gameReducer(state, setGameStatus('waiting'));
      state = gameReducer(state, updateScore({ player: 'left', points: 0 }));

      // Second win
      state = gameReducer(state, updateScore({ player: 'left', points: 10 }));
      expect(state.wins.left).toBe(2);
    });
  });

  describe('resetGame', () => {
    it('should reset game state but keep wins', () => {
      // First set up a game with some score and a win
      let state = gameReducer(initialState, updateScore({ player: 'left', points: 10 }));
      expect(state.wins.left).toBe(1);

      // Reset the game
      state = gameReducer(state, setGameStatus('waiting'));
      state = gameReducer(state, updateScore({ player: 'left', points: 0 }));

      // Verify score is reset but wins remain
      expect(state.score.left).toBe(0);
      expect(state.wins.left).toBe(1);
      expect(state.status).toBe('waiting');
    });
  });

  describe('updateBall', () => {
    it('should update ball position and velocity', () => {
      const newBall = {
        x: 60,
        y: 40,
        velocityX: 0.5,
        velocityY: -0.5,
      };
      const actual = gameReducer(initialState, updateBall(newBall));
      expect(actual.ball).toEqual(newBall);
    });

    it('should handle negative velocities', () => {
      const newBall = {
        x: 40,
        y: 60,
        velocityX: -0.5,
        velocityY: 0.5,
      };
      const actual = gameReducer(initialState, updateBall(newBall));
      expect(actual.ball).toEqual(newBall);
    });
  });

  describe('updateLeftPaddle', () => {
    it('should update left paddle position', () => {
      const actual = gameReducer(initialState, updateLeftPaddle(75));
      expect(actual.leftPaddle.y).toBe(75);
    });

    it('should handle edge positions', () => {
      const positions = [0, 100];
      positions.forEach(position => {
        const actual = gameReducer(initialState, updateLeftPaddle(position));
        expect(actual.leftPaddle.y).toBe(position);
      });
    });
  });

  describe('updateRightPaddle', () => {
    it('should update right paddle position', () => {
      const actual = gameReducer(initialState, updateRightPaddle(25));
      expect(actual.rightPaddle.y).toBe(25);
    });

    it('should handle edge positions', () => {
      const positions = [0, 100];
      positions.forEach(position => {
        const actual = gameReducer(initialState, updateRightPaddle(position));
        expect(actual.rightPaddle.y).toBe(position);
      });
    });
  });
}); 