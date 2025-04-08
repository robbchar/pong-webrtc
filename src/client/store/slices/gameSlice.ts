import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type GameStatus = 'waiting' | 'countdown' | 'playing' | 'paused' | 'gameOver';

interface GameState {
  status: GameStatus;
  ball: {
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
  };
  leftPaddle: {
    y: number;
  };
  rightPaddle: {
    y: number;
  };
  score: {
    left: number;
    right: number;
  };
  countdown: number;
  isReady: boolean;
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
  countdown: 5,
  isReady: false,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setGameStatus: (state, action: PayloadAction<GameStatus>) => {
      state.status = action.payload;
    },
    updateBall: (state, action: PayloadAction<GameState['ball']>) => {
      state.ball = action.payload;
    },
    updateLeftPaddle: (state, action: PayloadAction<number>) => {
      state.leftPaddle.y = action.payload;
    },
    updateRightPaddle: (state, action: PayloadAction<number>) => {
      state.rightPaddle.y = action.payload;
    },
    updateScore: (state, action: PayloadAction<{ player: 'left' | 'right'; points: number }>) => {
      state.score[action.payload.player] = action.payload.points;
    },
    setCountdown: (state, action: PayloadAction<number>) => {
      state.countdown = action.payload;
    },
    setReady: (state, action: PayloadAction<boolean>) => {
      state.isReady = action.payload;
    },
  },
});

export const {
  setGameStatus,
  updateBall,
  updateLeftPaddle,
  updateRightPaddle,
  updateScore,
  setCountdown,
  setReady,
} = gameSlice.actions;

export default gameSlice.reducer; 