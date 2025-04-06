import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type GameStatus = 'waiting' | 'countdown' | 'playing' | 'paused' | 'gameOver';

interface Ball {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

interface Paddle {
  y: number;
}

interface Score {
  left: number;
  right: number;
}

interface GameState {
  status: GameStatus;
  ball: Ball;
  leftPaddle: Paddle;
  rightPaddle: Paddle;
  score: Score;
}

const initialState: GameState = {
  status: 'waiting',
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

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setGameStatus: (state, action: PayloadAction<GameStatus>) => {
      state.status = action.payload;
    },
    updateBall: (state, action: PayloadAction<Partial<Ball>>) => {
      state.ball = { ...state.ball, ...action.payload };
    },
    updateLeftPaddle: (state, action: PayloadAction<Partial<Paddle>>) => {
      state.leftPaddle = { ...state.leftPaddle, ...action.payload };
    },
    updateRightPaddle: (state, action: PayloadAction<Partial<Paddle>>) => {
      state.rightPaddle = { ...state.rightPaddle, ...action.payload };
    },
    updateScore: (state, action: PayloadAction<{ player: 'left' | 'right'; points: number }>) => {
      if (action.payload.player === 'left') {
        state.score.left += action.payload.points;
      } else {
        state.score.right += action.payload.points;
      }
    },
    resetGame: () => {
      return initialState;
    },
  },
});

export const {
  setGameStatus,
  updateBall,
  updateLeftPaddle,
  updateRightPaddle,
  updateScore,
  resetGame,
} = gameSlice.actions;

export default gameSlice.reducer; 