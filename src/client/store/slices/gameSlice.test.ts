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

    it('should handle zero scores', () => {
      const actual = gameReducer(initialState, updateScore({ player: 'right', points: 0 }));
      expect(actual.score.left).toBe(0);
      expect(actual.score.right).toBe(0);
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
      const newPosition = { y: 75 };
      const actual = gameReducer(initialState, updateLeftPaddle(newPosition));
      expect(actual.leftPaddle.y).toBe(75);
    });

    it('should handle edge positions', () => {
      const positions = [{ y: 0 }, { y: 100 }];
      positions.forEach(position => {
        const actual = gameReducer(initialState, updateLeftPaddle(position));
        expect(actual.leftPaddle).toEqual(position);
      });
    });
  });

  describe('updateRightPaddle', () => {
    it('should update right paddle position', () => {
      const newPosition = { y: 25 };
      const actual = gameReducer(initialState, updateRightPaddle(newPosition));
      expect(actual.rightPaddle.y).toBe(25);
    });

    it('should handle edge positions', () => {
      const positions = [{ y: 0 }, { y: 100 }];
      positions.forEach(position => {
        const actual = gameReducer(initialState, updateRightPaddle(position));
        expect(actual.rightPaddle).toEqual(position);
      });
    });
  });
}); 